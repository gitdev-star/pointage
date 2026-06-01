# tests/unit/test_late_report_and_zk.py
"""
Tests targeting:
  - app/services/late_report_service.py  (30% → target ~75%)
  - app/devices/zk_reader.py             (0%  → target ~70%)

Run with:
  pytest tests/unit/test_late_report_and_zk.py -v
"""

import asyncio
import logging
from collections import namedtuple
from datetime import date, datetime, time
from unittest.mock import AsyncMock, MagicMock, Mock, patch, call

import pytest

# ═══════════════════════════════════════════════════════════════════════════════
# Shared fixtures / helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _make_schedule(work_start: time = time(8, 0), grace: int = 5) -> "ScheduleRules":
    """Return a minimal ScheduleRules-like object."""
    from app.services.analysis_service import ScheduleRules
    rules = MagicMock(spec=ScheduleRules)
    rules.work_start = work_start
    rules.grace_minutes = grace
    return rules


def _make_day_rec(
    is_weekend: bool = False,
    is_late: bool = False,
    arrival: datetime = None,
    date_: date = date(2025, 1, 6),
    day_name: str = "Monday",
):
    rec = MagicMock()
    rec.is_weekend = is_weekend
    rec.is_late = is_late
    rec.arrival = arrival
    rec.date = date_
    rec.day_name = day_name
    return rec


# ═══════════════════════════════════════════════════════════════════════════════
# late_report_service — unit tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestHelpers:
    """Pure-function helpers in late_report_service."""

    def test_hhmm_with_datetime(self):
        from app.services.late_report_service import _hhmm
        dt = datetime(2025, 1, 6, 8, 45)
        assert _hhmm(dt) == "08:45"

    def test_hhmm_with_none(self):
        from app.services.late_report_service import _hhmm
        assert _hhmm(None) is None

    def test_minutes_late_positive(self):
        from app.services.late_report_service import _minutes_late
        rules = _make_schedule(work_start=time(8, 0))
        arrival = datetime(2025, 1, 6, 8, 20)   # 20 min late
        assert _minutes_late(arrival, rules) == 20

    def test_minutes_late_early_arrival_returns_zero(self):
        from app.services.late_report_service import _minutes_late
        rules = _make_schedule(work_start=time(8, 0))
        arrival = datetime(2025, 1, 6, 7, 50)   # 10 min early
        assert _minutes_late(arrival, rules) == 0

    def test_minutes_late_exactly_on_time(self):
        from app.services.late_report_service import _minutes_late
        rules = _make_schedule(work_start=time(8, 0))
        arrival = datetime(2025, 1, 6, 8, 0)
        assert _minutes_late(arrival, rules) == 0


class TestGetHrConnection:
    """_get_hr_connection reads env vars and calls psycopg2.connect."""

    @patch("app.services.late_report_service.os.environ.get")
    @patch("psycopg2.connect")
    def test_uses_env_vars(self, mock_connect, mock_env):
        mock_env.side_effect = lambda k, default=None: {
            "HR_DB_HOST": "myhost",
            "HR_DB_PORT": "5433",
            "HR_DB_NAME": "mydb",
            "HR_DB_USER": "myuser",
            "HR_DB_PASSWORD": "secret",
            "HR_DB_SSLMODE": "disable",
        }.get(k, default)

        from app.services.late_report_service import _get_hr_connection
        _get_hr_connection()

        mock_connect.assert_called_once_with(
            host="myhost",
            port=5433,
            dbname="mydb",
            user="myuser",
            password="secret",
            connect_timeout=5,
            sslmode="disable",
        )

    @patch("psycopg2.connect")
    def test_returns_connection(self, mock_connect):
        mock_connect.return_value = MagicMock()
        from app.services.late_report_service import _get_hr_connection
        conn = _get_hr_connection()
        assert conn is mock_connect.return_value


class TestGetEmployeeIdsByClassification:
    """_get_employee_ids_by_classification"""

    def test_returns_none_for_none_classification(self):
        from app.services.late_report_service import _get_employee_ids_by_classification
        result = _get_employee_ids_by_classification(None)
        assert result is None

    def test_returns_none_for_all(self):
        from app.services.late_report_service import _get_employee_ids_by_classification
        result = _get_employee_ids_by_classification("ALL")
        assert result is None

    def test_returns_none_for_all_case_insensitive(self):
        from app.services.late_report_service import _get_employee_ids_by_classification
        result = _get_employee_ids_by_classification("all")
        assert result is None

    @patch("app.services.late_report_service._get_hr_connection")
    def test_returns_set_of_ints(self, mock_conn_fn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [("000079",), ("000012",), ("000003",)]
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn_fn.return_value = mock_conn

        from app.services.late_report_service import _get_employee_ids_by_classification
        result = _get_employee_ids_by_classification("HC")

        assert result == {79, 12, 3}
        mock_conn.close.assert_called_once()

    @patch("app.services.late_report_service._get_hr_connection")
    def test_skips_none_rows(self, mock_conn_fn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [("000079",), (None,)]
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn_fn.return_value = mock_conn

        from app.services.late_report_service import _get_employee_ids_by_classification
        result = _get_employee_ids_by_classification("HC")
        assert result == {79}

    @patch("app.services.late_report_service._get_hr_connection")
    def test_returns_none_on_db_error(self, mock_conn_fn):
        mock_conn_fn.side_effect = Exception("DB down")

        from app.services.late_report_service import _get_employee_ids_by_classification
        result = _get_employee_ids_by_classification("HC")
        assert result is None


class TestGetAllClassifications:
    """get_all_classifications"""

    @patch("app.services.late_report_service._get_hr_connection")
    def test_returns_list_of_strings(self, mock_conn_fn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [("HC",), ("NON-HC",), ("TEMP",)]
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn_fn.return_value = mock_conn

        from app.services.late_report_service import get_all_classifications
        result = get_all_classifications()
        assert result == ["HC", "NON-HC", "TEMP"]
        mock_conn.close.assert_called_once()

    @patch("app.services.late_report_service._get_hr_connection")
    def test_returns_empty_list_on_error(self, mock_conn_fn):
        mock_conn_fn.side_effect = Exception("Network error")

        from app.services.late_report_service import get_all_classifications
        result = get_all_classifications()
        assert result == []


class TestComputeLateReport:
    """compute_late_report — integration-style unit tests with mocked DB and schedule."""

    def _make_db_row(self, user_id, date_, first_punch, last_punch, punch_count=2):
        row = MagicMock()
        row.user_id = user_id
        row.date = date_
        row.first_punch = first_punch
        row.last_punch = last_punch
        row.punch_count = punch_count
        return row

    def _make_db(self, rows):
        """
        Build an async DB mock where db.execute() is awaitable but
        result.all() is a plain sync call (mirrors real SQLAlchemy behaviour).
        """
        db = AsyncMock()
        sync_result = MagicMock()
        sync_result.all.return_value = rows
        # db.execute(...) is awaited → its return value must be set on the
        # coroutine's return, not on a nested AsyncMock chain.
        db.execute.return_value = sync_result
        return db

    @pytest.mark.asyncio
    async def test_returns_empty_result_when_no_rows(self):
        from app.services.late_report_service import compute_late_report, LateReportResult

        db = self._make_db([])

        with patch("app.services.late_report_service._get_employee_ids_by_classification", return_value=None):
            result = await compute_late_report(db, year=2025, month=1, min_late=1)

        assert isinstance(result, LateReportResult)
        assert result.total_employees_analyzed == 0
        assert result.employees == []

    @pytest.mark.asyncio
    async def test_classification_all_skips_filter(self):
        from app.services.late_report_service import compute_late_report

        db = self._make_db([])

        with patch("app.services.late_report_service._get_employee_ids_by_classification") as mock_filter:
            await compute_late_report(db, 2025, 1, 1, classification="ALL")
            mock_filter.assert_not_called()

    @pytest.mark.asyncio
    async def test_default_mode_excludes_hc(self):
        """classification=None → exclude HC employees."""
        from app.services.late_report_service import compute_late_report

        db = self._make_db([])

        with patch("app.services.late_report_service._get_employee_ids_by_classification") as mock_filter:
            mock_filter.return_value = {79}
            await compute_late_report(db, 2025, 1, 1, classification=None)
            mock_filter.assert_called_once_with("HC")

    @pytest.mark.asyncio
    async def test_named_classification_sets_allowed_ids(self):
        from app.services.late_report_service import compute_late_report

        db = self._make_db([])

        with patch("app.services.late_report_service._get_employee_ids_by_classification") as mock_filter:
            mock_filter.return_value = {10, 20}
            await compute_late_report(db, 2025, 1, 1, classification="TEMP")
            mock_filter.assert_called_once_with("TEMP")

    @pytest.mark.asyncio
    async def test_employees_below_min_late_excluded(self):
        """Employee with 0 late days should not appear in results when min_late=1."""
        from app.services.late_report_service import compute_late_report
        from app.services.analysis_service import ScheduleRules

        rules = _make_schedule(work_start=time(8, 0))
        day_rec = _make_day_rec(is_weekend=False, is_late=False, arrival=datetime(2025, 1, 6, 7, 55))

        row = self._make_db_row(1, date(2025, 1, 6), datetime(2025, 1, 6, 7, 55), datetime(2025, 1, 6, 17, 0))
        db = self._make_db([row])

        with patch("app.services.late_report_service._get_employee_ids_by_classification", return_value=None), \
             patch("app.services.late_report_service.get_schedule_for_employee", return_value=rules), \
             patch("app.services.late_report_service._analyze_day", return_value=day_rec):
            result = await compute_late_report(db, 2025, 1, 1, classification="ALL")

        assert result.total_late_employees == 0
        assert result.employees == []

    @pytest.mark.asyncio
    async def test_late_employee_appears_in_results(self):
        """Employee with 1+ late days should appear when min_late=1."""
        from app.services.late_report_service import compute_late_report

        rules = _make_schedule(work_start=time(8, 0))
        day_rec = _make_day_rec(
            is_weekend=False,
            is_late=True,
            arrival=datetime(2025, 1, 6, 8, 30),
            date_=date(2025, 1, 6),
            day_name="Monday",
        )

        row = self._make_db_row(
            user_id=42,
            date_=date(2025, 1, 6),
            first_punch=datetime(2025, 1, 6, 8, 30),
            last_punch=datetime(2025, 1, 6, 17, 0),
        )
        db = self._make_db([row])

        with patch("app.services.late_report_service._get_employee_ids_by_classification", return_value=None), \
             patch("app.services.late_report_service.get_schedule_for_employee", return_value=rules), \
             patch("app.services.late_report_service._analyze_day", return_value=day_rec):
            result = await compute_late_report(db, 2025, 1, 1, classification="ALL")

        assert result.total_late_employees == 1
        assert result.employees[0].user_id == 42
        assert result.employees[0].late_count == 1
        assert result.employees[0].late_days[0].minutes_late == 30

    @pytest.mark.asyncio
    async def test_weekend_days_not_counted_as_present(self):
        from app.services.late_report_service import compute_late_report

        rules = _make_schedule()
        day_rec = _make_day_rec(is_weekend=True, is_late=False)

        row = self._make_db_row(1, date(2025, 1, 4), datetime(2025, 1, 4, 9, 0), datetime(2025, 1, 4, 15, 0))
        db = self._make_db([row])

        with patch("app.services.late_report_service._get_employee_ids_by_classification", return_value=None), \
             patch("app.services.late_report_service.get_schedule_for_employee", return_value=rules), \
             patch("app.services.late_report_service._analyze_day", return_value=day_rec):
            result = await compute_late_report(db, 2025, 1, 1, classification="ALL")

        # Weekend day skipped → present_count=0 → below min_late → not in results
        assert result.employees == []

    @pytest.mark.asyncio
    async def test_allowed_ids_filters_out_other_users(self):
        """When classification='TEMP', only allowed_ids users are included."""
        from app.services.late_report_service import compute_late_report

        rules = _make_schedule()
        day_rec = _make_day_rec(is_late=True, arrival=datetime(2025, 1, 6, 9, 0))

        rows = [
            self._make_db_row(10, date(2025, 1, 6), datetime(2025, 1, 6, 9, 0), datetime(2025, 1, 6, 17, 0)),
            self._make_db_row(99, date(2025, 1, 6), datetime(2025, 1, 6, 9, 0), datetime(2025, 1, 6, 17, 0)),
        ]
        db = self._make_db(rows)

        with patch("app.services.late_report_service._get_employee_ids_by_classification", return_value={10}), \
             patch("app.services.late_report_service.get_schedule_for_employee", return_value=rules), \
             patch("app.services.late_report_service._analyze_day", return_value=day_rec):
            result = await compute_late_report(db, 2025, 1, 1, classification="TEMP")

        user_ids = [e.user_id for e in result.employees]
        assert 10 in user_ids
        assert 99 not in user_ids

    @pytest.mark.asyncio
    async def test_excluded_ids_filters_out_hc(self):
        """Default mode excludes HC users (excluded_ids)."""
        from app.services.late_report_service import compute_late_report

        rules = _make_schedule()
        day_rec = _make_day_rec(is_late=True, arrival=datetime(2025, 1, 6, 9, 0))

        rows = [
            self._make_db_row(79, date(2025, 1, 6), datetime(2025, 1, 6, 9, 0), datetime(2025, 1, 6, 17, 0)),
            self._make_db_row(5,  date(2025, 1, 6), datetime(2025, 1, 6, 9, 0), datetime(2025, 1, 6, 17, 0)),
        ]
        db = self._make_db(rows)

        with patch("app.services.late_report_service._get_employee_ids_by_classification", return_value={79}), \
             patch("app.services.late_report_service.get_schedule_for_employee", return_value=rules), \
             patch("app.services.late_report_service._analyze_day", return_value=day_rec):
            result = await compute_late_report(db, 2025, 1, 1, classification=None)

        user_ids = [e.user_id for e in result.employees]
        assert 79 not in user_ids
        assert 5 in user_ids

    @pytest.mark.asyncio
    async def test_results_sorted_by_late_count_desc(self):
        from app.services.late_report_service import compute_late_report

        rules = _make_schedule()
        late_day = _make_day_rec(is_late=True, arrival=datetime(2025, 1, 6, 9, 0))

        rows = [
            self._make_db_row(1, date(2025, 1, 6), datetime(2025, 1, 6, 9, 0), datetime(2025, 1, 6, 17, 0)),
            self._make_db_row(2, date(2025, 1, 6), datetime(2025, 1, 6, 9, 0), datetime(2025, 1, 6, 17, 0)),
            self._make_db_row(2, date(2025, 1, 7), datetime(2025, 1, 7, 9, 0), datetime(2025, 1, 7, 17, 0)),
        ]
        db = self._make_db(rows)

        with patch("app.services.late_report_service._get_employee_ids_by_classification", return_value=None), \
             patch("app.services.late_report_service.get_schedule_for_employee", return_value=rules), \
             patch("app.services.late_report_service._analyze_day", return_value=late_day):
            result = await compute_late_report(db, 2025, 1, 1, classification="ALL")

        assert result.employees[0].user_id == 2
        assert result.employees[0].late_count >= result.employees[-1].late_count


# ═══════════════════════════════════════════════════════════════════════════════
# zk_reader — unit tests (all ZK hardware mocked)
# ═══════════════════════════════════════════════════════════════════════════════

class TestZKReaderInit:
    @patch("app.devices.zk_reader.ZK")
    def test_default_port_and_timeout(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        reader = ZKReader("192.168.1.10")
        assert reader.device_ip == "192.168.1.10"
        assert reader.device_port == 4370
        assert reader.timeout == 10
        assert reader.connection is None
        assert reader.consecutive_errors == 0

    @patch("app.devices.zk_reader.ZK")
    def test_custom_port_and_timeout(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        reader = ZKReader("10.0.0.1", device_port=9999, timeout=30)
        assert reader.device_port == 9999
        assert reader.timeout == 30


class TestZKReaderConnect:
    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_connect_success(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn

        reader = ZKReader("192.168.1.10")
        await reader.connect()

        assert reader.connection is mock_conn

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_connect_skips_if_already_connected(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        reader = ZKReader("192.168.1.10")
        reader.connection = MagicMock()  # already connected

        await reader.connect()
        mock_zk_cls.return_value.connect.assert_not_called()

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_connect_raises_on_failure(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        mock_zk_cls.return_value.connect.side_effect = Exception("Timeout")

        reader = ZKReader("192.168.1.10")
        with pytest.raises(RuntimeError, match="Connection failed"):
            await reader.connect()

        assert reader.connection is None


class TestZKReaderDisconnect:
    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_disconnect_calls_device_disconnect(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        mock_conn = MagicMock()
        reader = ZKReader("192.168.1.10")
        reader.connection = mock_conn

        await reader.disconnect()

        mock_conn.disconnect.assert_called_once()
        assert reader.connection is None

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_disconnect_noop_when_not_connected(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        reader = ZKReader("192.168.1.10")
        # Should not raise
        await reader.disconnect()
        assert reader.connection is None

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_disconnect_swallows_device_exception(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        mock_conn = MagicMock()
        mock_conn.disconnect.side_effect = Exception("Device error")
        reader = ZKReader("192.168.1.10")
        reader.connection = mock_conn

        # Should not raise
        await reader.disconnect()
        assert reader.connection is None


class TestZKReaderForceReset:
    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_force_reset_clears_connection_and_errors(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader
        mock_conn = MagicMock()
        reader = ZKReader("192.168.1.10")
        reader.connection = mock_conn
        reader.consecutive_errors = 5

        await reader.force_reset()

        assert reader.connection is None
        assert reader.consecutive_errors == 0


class TestZKReaderFetchAttendanceLogs:
    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_returns_filtered_logs_by_year(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader, YEAR_CUTOFF

        old_log = MagicMock()
        old_log.timestamp = datetime(YEAR_CUTOFF - 1, 12, 31, 8, 0)
        new_log = MagicMock()
        new_log.timestamp = datetime(YEAR_CUTOFF, 1, 5, 8, 0)

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = [old_log, new_log]

        reader = ZKReader("192.168.1.10")
        await reader.connect()
        logs = await reader.fetch_attendance_logs()

        assert new_log in logs
        assert old_log not in logs

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_logs_returned_latest_first(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader, YEAR_CUTOFF

        log1 = MagicMock()
        log1.timestamp = datetime(YEAR_CUTOFF, 1, 1, 8, 0)
        log2 = MagicMock()
        log2.timestamp = datetime(YEAR_CUTOFF, 1, 5, 8, 0)

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        # Device returns oldest first
        mock_zk_cls.return_value.get_attendance.return_value = [log1, log2]

        reader = ZKReader("192.168.1.10")
        await reader.connect()
        logs = await reader.fetch_attendance_logs()

        # After reversed(), log2 (Jan 5) should come before log1 (Jan 1)
        assert logs.index(log2) < logs.index(log1)

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_resets_consecutive_errors_on_success(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader, YEAR_CUTOFF

        log = MagicMock()
        log.timestamp = datetime(YEAR_CUTOFF, 1, 5, 8, 0)
        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = [log]

        reader = ZKReader("192.168.1.10")
        reader.consecutive_errors = 2
        await reader.connect()
        await reader.fetch_attendance_logs()

        assert reader.consecutive_errors == 0

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_auto_connects_when_not_connected(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader, YEAR_CUTOFF

        log = MagicMock()
        log.timestamp = datetime(YEAR_CUTOFF, 1, 5, 8, 0)
        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = [log]

        reader = ZKReader("192.168.1.10")
        # Don't call connect() first
        await reader.fetch_attendance_logs()

        mock_zk_cls.return_value.connect.assert_called_once()

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_increments_errors_and_raises_on_failure(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.side_effect = Exception("Read error")

        reader = ZKReader("192.168.1.10")
        await reader.connect()

        with pytest.raises(Exception, match="Read error"):
            await reader.fetch_attendance_logs()

        assert reader.consecutive_errors == 1

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_force_cleanup_after_3_consecutive_errors(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.side_effect = Exception("Read error")

        reader = ZKReader("192.168.1.10")
        reader.consecutive_errors = 2
        await reader.connect()

        with pytest.raises(Exception):
            await reader.fetch_attendance_logs()

        # After 3rd error → force cleanup → connection = None, errors = 0
        assert reader.connection is None
        assert reader.consecutive_errors == 0

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_handles_empty_attendance(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = []

        reader = ZKReader("192.168.1.10")
        await reader.connect()
        logs = await reader.fetch_attendance_logs()

        assert logs == []

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_handles_none_attendance(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = None

        reader = ZKReader("192.168.1.10")
        await reader.connect()
        logs = await reader.fetch_attendance_logs()

        assert logs == []


class TestZKReaderProcessLogs:
    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_returns_zero_when_no_logs(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = []

        reader = ZKReader("192.168.1.10")
        await reader.connect()

        db = AsyncMock()
        result = await reader.process_logs(db)
        assert result == 0

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_inserts_valid_logs(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader, YEAR_CUTOFF

        ts = datetime(YEAR_CUTOFF, 1, 5, 8, 30)
        log = MagicMock()
        log.user_id = "000042"
        log.timestamp = ts
        log.uid = 12345

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = [log]

        reader = ZKReader("192.168.1.10")
        await reader.connect()

        db = AsyncMock()
        with patch("app.devices.zk_reader.insert") as mock_insert:
            mock_stmt = MagicMock()
            mock_insert.return_value.values.return_value = mock_stmt
            mock_stmt.on_conflict_do_nothing.return_value = mock_stmt

            result = await reader.process_logs(db)

        assert result > 0
        db.execute.assert_called()
        db.commit.assert_called()

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_generates_uid_when_none(self, mock_zk_cls):
        """When log.uid is None, uid is synthesized from user_id + timestamp."""
        from app.devices.zk_reader import ZKReader, YEAR_CUTOFF

        ts = datetime(YEAR_CUTOFF, 1, 5, 8, 30)
        log = MagicMock()
        log.user_id = "42"
        log.timestamp = ts
        log.uid = None  # triggers synthetic uid path

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = [log]

        reader = ZKReader("192.168.1.10")
        await reader.connect()

        db = AsyncMock()
        with patch("app.devices.zk_reader.insert") as mock_insert:
            mock_stmt = MagicMock()
            mock_insert.return_value.values.return_value = mock_stmt
            mock_stmt.on_conflict_do_nothing.return_value = mock_stmt
            result = await reader.process_logs(db)

        assert result > 0

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_rollback_on_db_error(self, mock_zk_cls):
        from app.devices.zk_reader import ZKReader, YEAR_CUTOFF

        ts = datetime(YEAR_CUTOFF, 1, 5, 8, 30)
        log = MagicMock()
        log.user_id = "42"
        log.timestamp = ts
        log.uid = 99

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = [log]

        reader = ZKReader("192.168.1.10")
        await reader.connect()

        db = AsyncMock()
        db.execute.side_effect = Exception("DB error")

        with patch("app.devices.zk_reader.insert"):
            result = await reader.process_logs(db)

        assert result == 0
        db.rollback.assert_called_once()

    @patch("app.devices.zk_reader.ZK")
    @pytest.mark.asyncio
    async def test_skips_bad_log_entries(self, mock_zk_cls):
        """Logs that raise during processing are skipped gracefully."""
        from app.devices.zk_reader import ZKReader, YEAR_CUTOFF

        bad_log = MagicMock()
        bad_log.user_id = "NOT_AN_INT"   # will raise ValueError on int()
        bad_log.timestamp = datetime(YEAR_CUTOFF, 1, 5, 8, 30)

        mock_conn = MagicMock()
        mock_zk_cls.return_value.connect.return_value = mock_conn
        mock_zk_cls.return_value.get_attendance.return_value = [bad_log]

        reader = ZKReader("192.168.1.10")
        await reader.connect()

        db = AsyncMock()
        result = await reader.process_logs(db)
        # No valid rows → 0, no crash
        assert result == 0
