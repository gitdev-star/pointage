import base64
import os
from datetime import datetime

CACHET_PATH = os.path.join(os.path.dirname(__file__), "asset", "image.jpg")
_CACHET_CACHE = {"data_url": None, "loaded": False}

MONTHS_FR = ["","janvier","f\u00e9vrier","mars","avril","mai","juin",
             "juillet","ao\u00fbt","septembre","octobre","novembre","d\u00e9cembre"]


def fmt_date(value):
    if not value:
        return "\u2014"
    if isinstance(value, str):
        try:
            value = datetime.strptime(value[:10], "%Y-%m-%d").date()
        except Exception:
            return value
    return f"{value.day:02d} {MONTHS_FR[value.month]} {value.year}"

def _encode_photo(emp):
    """Retourne l'URL data: base64 de la photo employé, ou None si absente."""
    try:
        if emp.photo and hasattr(emp.photo, "path") and os.path.exists(emp.photo.path):
            with open(emp.photo.path, "rb") as f:
                data = f.read()
            ext = os.path.splitext(emp.photo.path)[1].lower().lstrip(".") or "jpeg"
            mime = "jpeg" if ext in ("jpg", "jpeg") else ext
            return f"data:image/{mime};base64,{base64.b64encode(data).decode()}"
    except Exception:
        pass
    return None


def _encode_cachet():
    """Encode l'image du cachet en base64 (mise en cache en mémoire, image statique)."""
    if _CACHET_CACHE["loaded"]:
        return _CACHET_CACHE["data_url"]
    _CACHET_CACHE["loaded"] = True
    try:
        if os.path.exists(CACHET_PATH):
            with open(CACHET_PATH, "rb") as f:
                data = f.read()
            ext = os.path.splitext(CACHET_PATH)[1].lower().lstrip(".") or "png"
            mime = "jpeg" if ext in ("jpg", "jpeg") else ext
            _CACHET_CACHE["data_url"] = f"data:image/{mime};base64,{base64.b64encode(data).decode()}"
    except Exception:
        pass
    return _CACHET_CACHE["data_url"]


def build_badge_html(emp):
    photo_url = _encode_photo(emp)
    photo_html = (
        f'<img src="{photo_url}" class="photo"/>'
        if photo_url else
        '<div class="photo photo-empty"></div>'
    )

    cachet_url = _encode_cachet()
    cachet_html = (
        f'<img src="{cachet_url}" class="cachet" />'
        if cachet_url else
        '<div class="cachet cachet-empty">Cachet</div>'
    )

    name = f"{emp.last_name or ''} {emp.first_name or ''}".strip()
    fonction = emp.job_title.name if emp.job_title else "—"
    service = emp.department.name if emp.department else "—"
    factory = emp.factory.name if emp.factory else "—"
    matricule = emp.employee_id or "—"
    date_embauche = fmt_date(emp.hire_date)
    n_rh = emp.n_rh or "—"


    return f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8" />
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        @page {{ size: 260mm 180mm; margin: 0; }}
        body {{ font-family: Arial, sans-serif; }}

        .badge {{
            width: 260mm;
            height: 180mm;
            display: flex;
            border: 1.5px solid #333;
        }}

        .col {{
            width: 50%;
            height: 100%;
            padding: 9mm;
            position: relative;
        }}

        .col-left {{
            border-right: 1.5px solid #333;
            display: flex;
            flex-direction: column;
        }}

        .photo-row {{
            display: flex;
            align-items: flex-start;
            gap: 8mm;
            margin-bottom: 12mm;
        }}

        .photo {{
            width: 50mm;
            height: 60mm;
            border: 1.5px solid #000;
            object-fit: cover;
        }}
        .photo-empty {{
            background: #fff;
        }}

        .cachet {{
            width: 60mm;
            height: 60mm;
            object-fit: contain;
            align-self: center;
        }}
        .cachet-empty {{
            border: 1.5px dashed #ccc;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #ccc;
            font-weight: 600;
            transform: rotate(-12deg);
        }}

        .info p {{
            font-size: 18px;
            margin-bottom: 6mm;
            color: #111;
        }}
        .info strong {{ font-weight: 700; }}

        .col-right h2 {{
            font-size: 16px;
            text-align: center;
            text-decoration: underline;
            margin-bottom: 3mm;
        }}
        .col-right .rule {{
            font-size: 15px;
            margin-bottom: 4mm;
            line-height: 1.4;
        }}
        .rule .fr {{ color: #1a56c4; font-weight: 700; }}
        .rule .mg {{ text-decoration: underline; }}
        .rule-warning {{
            font-size: 16px;
            color: #c0272d;
            font-weight: 700;
            text-align: center;
            margin-top: 6mm;
        }}
    </style>
    </head>
    <body>
        <div class="badge">
            <div class="col col-left">
                <div class="photo-row">
                    {photo_html}
                    {cachet_html}
                </div>
                <div class="info">
                    <p><strong>N°</strong>&nbsp;&nbsp;{matricule}&nbsp;&nbsp;&nbsp;&nbsp;
                    <strong>Site :</strong> {factory}</p>
                    <p><strong>Nom et prénoms :</strong> {name}</p>
                    <p><strong>Fonction :</strong> {fonction}</p>
                    <p><strong>Service :</strong> {service}</p>
                    <p><strong>Date d'embauche :</strong> {date_embauche}</p>
                    <p><strong>Numero RH :</strong> {n_rh}</p>
                </div>
            </div>
            <div class="col col-right">
                <h2>CONSIGNES D'EVACUATION<br/>TOROMARIKA HO AN'NY FIVOAHANA RAHA MISY LOZA</h2>

                <div class="rule">
                    <span class="fr">Evacuez les locaux dès que vous entendez l'alarme d'incendie.</span>
                    <span class="mg">(Mivoaka avy hatrany raha maheno feo fanairana amin'ny loza.)</span>
                </div>
                <div class="rule">
                    <span class="fr">Suivez les consignes du responsable d'évacuation.</span>
                    <span class="mg">(Araho ny toromarika omen'ny tompon'andraikitra.)</span>
                </div>
                <div class="rule">
                    <span class="fr">Dirigez-vous vers les sorties de secours.</span>
                    <span class="mg">(Mamonjy avy hatrany ny varavaram-pivoahana raha misy loza.</span>
                </div>
                <div class="rule">
                    <span class="fr">N'utilisez pas les monte-charges pour évacuer.</span>
                    <span class="mg">(Tsy azo atao ny mampiasa ny "monte charge" ivoahana)</span>
                </div>
                <div class="rule">
                    <span class="fr">Fermez les portes et fenêtres derrière vous, ne revenez pas en arrière.</span>
                    <span class="mg">(Hidio ny varavaran-kely sy varavarana ao aorianao ary aza miverin-dalana.)</span>
                </div>
                <div class="rule">
                    <span class="fr">Rendez-vous au point de rassemblement.
                    Assurez-vous que tous vos collègues sont bien présents.</span>
                    <span class="mg">(Mivondrona eo @ toerana voatokana ary manao fiantsoana sao misy tsy ao.)</span>
                </div>

                <div class="rule-warning">
                    Port de badge obligatoire à l'usine<br/>
                    <span class="mg">Tsy maintsy anaovana ao amin'ny toeram-piasana ny « badge »</span>
                </div>
            </div>
        </div>
    </body>
    </html>
    """


def build_badge_pdf(emp):
    """Convertit le badge HTML en bytes PDF via WeasyPrint."""
    from weasyprint import HTML
    html_content = build_badge_html(emp)
    return HTML(string=html_content).write_pdf()