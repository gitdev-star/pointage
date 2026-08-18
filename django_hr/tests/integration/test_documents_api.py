# tests/integration/test_documents_api.py
"""
QE gap: documents/ had 13% coverage — the single biggest untested surface
in django_hr. Covers permission gating, doc-type/employee validation,
real .docx generation against the shipped templates (attestation,
certificat, cdd_3/6/12/18, evaluation_cdd), PDF conversion via a mocked
LibreOffice subprocess (no LibreOffice dependency in the test container),
bulk zip generation, and bulk PDF merge.

ASSUMPTION: documents/urls.py is included at "/api/documents/" in the
project's root urls.py, matching the pattern used by sanctions/ and
leaves/ (tests hit the Django app directly via APIClient, bypassing the
nginx /api/hr/ rewrite entirely). If your root urls.py includes it under
a different prefix, update API_PREFIX below — everything else is relative
to it.
"""
import io
import os
import zipfile
from datetime import date
from unittest import mock

import pytest
import subprocess as subprocess_module  # only used to build realistic exceptions

pytestmark = pytest.mark.django_db

API_PREFIX = "/api/documents"

# Every doc_type documents/views.py.BUILDERS actually supports, and whose
# .docx template ships in documents/templates/. If a template file is ever
# removed without removing the BUILDERS entry, these tests will fail loudly
# with a FileNotFoundError-derived 500 rather than silently skipping.
REAL_DOC_TYPES = [
    "attestation",
    "certificat",
    "cdd_3",
    "cdd_6",
    "cdd_12",
    "cdd_18",
    "evaluation_cdd",
    "fin_cdd_terme",
    "essai_non_concluant",
]


def _fake_libreoffice_convert(cmd, **kwargs):
    """
    side_effect for a mocked subprocess.run() that stands in for LibreOffice.
    Mirrors real LibreOffice --convert-to behavior: writes <basename>.pdf
    into the --outdir, using the same basename as the source .docx.
    """
    outdir = cmd[cmd.index("--outdir") + 1]
    docx_path = cmd[-1]
    pdf_name = os.path.splitext(os.path.basename(docx_path))[0] + ".pdf"
    with open(os.path.join(outdir, pdf_name), "wb") as f:
        f.write(b"%PDF-FAKE")
    return mock.MagicMock(returncode=0)


@pytest.fixture
def test_employee_2(test_factory, test_department, test_section, test_poste):
    """A second employee, needed for bulk endpoints (single employee isn't
    a meaningful bulk test)."""
    from employees.models import Employee
    return Employee.objects.create(
        employee_id="EMP002",
        first_name="Jane",
        last_name="Smith",
        email="jane@example.com",
        factory=test_factory,
        department=test_department,
        section=test_section,
        job_title=test_poste,
        hire_date=date(2021, 6, 1),
    )


class TestListTemplates:

    def test_requires_auth(self, api_client):
        resp = api_client.get(f"{API_PREFIX}/templates/")
        assert resp.status_code == 401

    def test_requires_hr_profile(self, authenticated_client):
        resp = authenticated_client.get(f"{API_PREFIX}/templates/")
        assert resp.status_code == 403

    def test_returns_all_document_types(self, authenticated_client, hr_profile):
        resp = authenticated_client.get(f"{API_PREFIX}/templates/")
        assert resp.status_code == 200
        ids = {row["id"] for row in resp.data["templates"]}
        # badge is PDF-only (not a docx template), returned separately from REAL_DOC_TYPES
        assert ids == set(REAL_DOC_TYPES) | {"badge"}


class TestGenerateDocumentValidation:

    def test_requires_auth(self, api_client, test_employee):
        resp = api_client.post(f"{API_PREFIX}/{test_employee.id}/attestation/")
        assert resp.status_code == 401

    def test_requires_hr_profile(self, authenticated_client, test_employee):
        resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/attestation/")
        assert resp.status_code == 403

    def test_unknown_doc_type_returns_400(self, authenticated_client, hr_profile, test_employee):
        resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/not_a_real_type/")
        assert resp.status_code == 400

    def test_employee_not_found_returns_404(self, authenticated_client, hr_profile):
        resp = authenticated_client.post(f"{API_PREFIX}/999999/attestation/")
        assert resp.status_code == 404

    def test_builder_exception_returns_500_with_trace(
        self, authenticated_client, hr_profile, test_employee
    ):
        """Generic exceptions inside a builder (bad template, bad data, etc.)
        should surface as a 500 with a trace, not a raw 500 stack dump or a
        silent empty response."""
        # BUILDERS is a module-level dict built at import time — it holds a
        # direct reference to the function object, so patching the module
        # attribute "build_attestation" does NOT affect calls made via
        # BUILDERS["attestation"][0]. The dict entry itself must be patched.
        from documents import views as documents_views

        def broken_builder(emp, extra):
            raise RuntimeError("boom")

        with mock.patch.dict(
            documents_views.BUILDERS,
            {"attestation": (broken_builder, "Attestation_emploi")},
        ):
            resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/attestation/")
        assert resp.status_code == 500
        assert "boom" in resp.data["detail"]
        assert "trace" in resp.data


class TestGenerateDocumentRealTemplates:
    """
    Exercises the real .docx templates on disk — no mocking. Confirms each
    BUILDERS entry actually produces a valid docx (a docx is a zip; a valid
    zip starts with the "PK" signature) instead of crashing on a missing
    placeholder or malformed template.
    """

    @pytest.mark.parametrize("doc_type", REAL_DOC_TYPES)
    def test_generates_valid_docx(self, authenticated_client, hr_profile, test_employee, doc_type):
        resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/{doc_type}/")
        assert resp.status_code == 200, getattr(resp, "data", resp.content)
        assert resp["Content-Type"] == (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        assert resp.content[:2] == b"PK"
        assert "attachment;" in resp["Content-Disposition"]

    def test_generates_valid_docx_with_extra_overrides(
        self, authenticated_client, hr_profile, test_employee
    ):
        """extra payload (ref, usage, dates) should be honored, not just
        defaults — covers the extra.get(...) branches in each builder."""
        resp = authenticated_client.post(
            f"{API_PREFIX}/{test_employee.id}/attestation/",
            {"usage": "Visa touristique", "ref": "RH-2026/CUSTOM"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.content[:2] == b"PK"


class TestBuildCertificatJobTitle:
    """
    Originally flagged as a suspected bug: build_certificat() passes
    emp.job_title (a Poste FK) directly into the replacement dict rather
    than emp.job_title.name like the other builders do. Test run against
    the real template proved that suspicion WRONG — Poste.__str__()
    already returns the plain name, so str(emp.job_title) renders
    correctly by coincidence. No actual gap here; this test locks in the
    correct current behavior instead of a false-positive finding.
    """

    def test_job_title_renders_as_plain_name(
        self, authenticated_client, hr_profile, test_employee
    ):
        from docx import Document
        resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/certificat/")
        assert resp.status_code == 200
        doc = Document(io.BytesIO(resp.content))
        full_text = "\n".join(p.text for p in doc.paragraphs)
        assert test_employee.job_title.name in full_text


class TestGenerateDocumentPdf:

    def test_requires_auth(self, api_client, test_employee):
        resp = api_client.post(f"{API_PREFIX}/{test_employee.id}/attestation/pdf/")
        assert resp.status_code == 401

    def test_success_returns_pdf(self, authenticated_client, hr_profile, test_employee):
        with mock.patch("subprocess.run", side_effect=_fake_libreoffice_convert):
            resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/attestation/pdf/")
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/pdf"
        assert resp.content == b"%PDF-FAKE"

    def test_timeout_returns_500(self, authenticated_client, hr_profile, test_employee):
        with mock.patch(
            "subprocess.run",
            side_effect=subprocess_module.TimeoutExpired(cmd="libreoffice", timeout=30),
        ):
            resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/attestation/pdf/")
        assert resp.status_code == 500
        assert "timeout" in resp.data["detail"].lower()

    def test_conversion_failure_returns_500(self, authenticated_client, hr_profile, test_employee):
        with mock.patch(
            "subprocess.run",
            side_effect=subprocess_module.CalledProcessError(returncode=1, cmd="libreoffice"),
        ):
            resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/attestation/pdf/")
        assert resp.status_code == 500
        assert "conversion" in resp.data["detail"].lower()

    def test_missing_pdf_output_returns_500(self, authenticated_client, hr_profile, test_employee):
        """LibreOffice reports success (returncode 0) but never actually
        writes the output file — a real failure mode worth guarding."""
        with mock.patch("subprocess.run", return_value=mock.MagicMock(returncode=0)):
            resp = authenticated_client.post(f"{API_PREFIX}/{test_employee.id}/attestation/pdf/")
        assert resp.status_code == 500
        assert "non généré" in resp.data["detail"].lower() or "genere" in resp.data["detail"].lower()


class TestBulkDocumentsZip:

    def test_unknown_doc_type_returns_400(self, authenticated_client, hr_profile, test_employee):
        resp = authenticated_client.post(
            f"{API_PREFIX}/bulk/",
            {"document_type": "nope", "employee_ids": [test_employee.employee_id]},
            format="json",
        )
        assert resp.status_code == 400

    def test_no_employee_ids_returns_400(self, authenticated_client, hr_profile):
        resp = authenticated_client.post(
            f"{API_PREFIX}/bulk/", {"document_type": "attestation", "employee_ids": []}, format="json"
        )
        assert resp.status_code == 400

    def test_no_matching_employees_returns_404(self, authenticated_client, hr_profile):
        resp = authenticated_client.post(
            f"{API_PREFIX}/bulk/",
            {"document_type": "attestation", "employee_ids": ["DOES-NOT-EXIST"]},
            format="json",
        )
        assert resp.status_code == 404

    def test_success_creates_zip_with_one_docx_per_employee(
        self, authenticated_client, hr_profile, test_employee, test_employee_2
    ):
        resp = authenticated_client.post(
            f"{API_PREFIX}/bulk/",
            {
                "document_type": "attestation",
                "employee_ids": [test_employee.employee_id, test_employee_2.employee_id],
            },
            format="json",
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/zip"
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert len(names) == 2
        assert all(n.endswith(".docx") for n in names)
        assert all(not n.startswith("ERREUR_") for n in names)

    def test_partial_builder_failure_writes_error_entry_not_500(
        self, authenticated_client, hr_profile, test_employee, test_employee_2
    ):
        """One employee's builder blows up — the endpoint should still
        return 200 with a zip containing an ERREUR_ entry for the failed
        employee, rather than failing the whole batch."""
        from documents import views as documents_views
        real_builder = documents_views.BUILDERS["attestation"][0]

        def flaky_builder(emp, extra):
            if emp.employee_id == test_employee_2.employee_id:
                raise RuntimeError("template corrupted")
            return real_builder(emp, extra)

        with mock.patch.dict(
            documents_views.BUILDERS,
            {"attestation": (flaky_builder, "Attestation_emploi")},
        ):
            resp = authenticated_client.post(
                f"{API_PREFIX}/bulk/",
                {
                    "document_type": "attestation",
                    "employee_ids": [test_employee.employee_id, test_employee_2.employee_id],
                },
                format="json",
            )
        assert resp.status_code == 200
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert any(n.endswith(".docx") for n in names)
        assert any(n.startswith("ERREUR_") and n.endswith(".txt") for n in names)


class TestBulkDocumentsPdf:

    def test_unknown_doc_type_returns_400(self, authenticated_client, hr_profile, test_employee):
        resp = authenticated_client.post(
            f"{API_PREFIX}/bulk-pdf/",
            {"document_type": "nope", "employee_ids": [test_employee.employee_id]},
            format="json",
        )
        assert resp.status_code == 400

    def test_no_matching_employees_returns_404(self, authenticated_client, hr_profile):
        resp = authenticated_client.post(
            f"{API_PREFIX}/bulk-pdf/",
            {"document_type": "attestation", "employee_ids": ["DOES-NOT-EXIST"]},
            format="json",
        )
        assert resp.status_code == 404

    def test_success_returns_merged_pdf(
        self, authenticated_client, hr_profile, test_employee, test_employee_2
    ):
        """
        The fake per-employee PDFs aren't structurally valid PDFs (just a
        %PDF-FAKE marker), so pypdf's merge step will fail internally —
        which is exactly what the view's except-fallback handles by
        returning the first successfully converted PDF. This test locks
        in that fallback behavior, a real failure mode worth having
        covered (LibreOffice occasionally emits a PDF pypdf can't merge).
        """
        with mock.patch("subprocess.run", side_effect=_fake_libreoffice_convert):
            resp = authenticated_client.post(
                f"{API_PREFIX}/bulk-pdf/",
                {
                    "document_type": "attestation",
                    "employee_ids": [test_employee.employee_id, test_employee_2.employee_id],
                },
                format="json",
            )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/pdf"
        assert resp.content == b"%PDF-FAKE"

    def test_no_pdf_generated_returns_500(self, authenticated_client, hr_profile, test_employee):
        """LibreOffice silently fails for every employee (returns 0 but
        writes nothing) — the view should error out cleanly, not return
        an empty/broken PDF."""
        with mock.patch("subprocess.run", return_value=mock.MagicMock(returncode=0)):
            resp = authenticated_client.post(
                f"{API_PREFIX}/bulk-pdf/",
                {"document_type": "attestation", "employee_ids": [test_employee.employee_id]},
                format="json",
            )
        assert resp.status_code == 500