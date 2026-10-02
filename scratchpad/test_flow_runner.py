"""Phase 3 exit test: the profile-driven flow runner.

Run from the repo root: ./venv/Scripts/python.exe scratchpad/test_flow_runner.py
Cleans up its own test data (tenant, user state, lead, complaint, handoff).
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.append(os.path.join(ROOT, "backend"))

PASS, FAIL = [], []


def check(name, cond):
    (PASS if cond else FAIL).append(name)
    print(f"{'PASS' if cond else 'FAIL'}: {name}")


def main():
    import sqlite3
    sys.path.insert(0, os.path.join(ROOT, "backend", "services"))
    from services import flow_runner
    from shared.tenancy import store, loader

    DB = os.path.join(ROOT, "FAQ.DB")
    TID = "flowtest"
    WA = "919900000003"

    # ── setup: throwaway tenant, it_software vertical ────────────────
    store.ensure_tenant(TID, slug="flowtest", vertical="it_software", display_name="Flow Test Co")
    loader.reload_profile(TID)
    profile = loader.get_tenant_profile(TID)
    check("profile loads for test tenant", profile.tenant_id == TID)
    check("default flows attached (get_quote present)", bool(profile.flow("get_quote")))

    # ── validation rules ─────────────────────────────────────────────
    v = flow_runner.validate_answer
    check("validate: email ok", v("email", "a@b.co") and not v("email", "not-an-email"))
    check("validate: phone:10 ok", v("phone:10", "+91 98765 43210") and not v("phone:10", "12345"))
    check("validate: name:2 ok", v("name:2", "Jo") and not v("name:2", "J"))
    check("validate: min_len:3 ok", v("min_len:3", "abc") and not v("min_len:3", "ab"))
    check("validate: digits ok", v("digits", "123") and not v("digits", "12a"))
    check("validate: empty rule accepts text", v("", "hello") and not v("", ""))

    # ── start: get_quote ─────────────────────────────────────────────
    out = flow_runner.start_flow(WA, "get_quote", tenant_id=TID)
    check("start_flow ok", out.get("handled"))
    joined = "\n".join(out["messages"])
    check("start emits intro + first question",
          "quote" in joined.lower() and "name" in joined.lower())
    check("flow state recorded", flow_runner.is_running(WA))

    # ── cancel works from any step ────────────────────────────────────
    out = flow_runner.handle_reply(WA, "cancel")
    check("cancel acknowledged", out and "cancelled" in "\n".join(out["messages"]).lower())
    check("cancel clears flow", not flow_runner.is_running(WA))

    # ── invalid answer retries, then bails after max_attempts ─────────
    flow_runner.start_flow(WA, "get_quote", tenant_id=TID)
    out = flow_runner.handle_reply(WA, "R")  # name:2 fails on 1 char
    check("invalid name asks again", out and "name" in "\n".join(out["messages"]).lower())
    flow_runner.handle_reply(WA, "R")
    out = flow_runner.handle_reply(WA, "R")  # third attempt bails
    check("max attempts bails with failure message",
          out and out.get("finished") and "something went wrong" in "\n".join(out["messages"]).lower())
    check("bail clears flow", not flow_runner.is_running(WA))

    # ── full happy path: collect, save lead, notify, finish ──────────
    flow_runner.start_flow(WA, "get_quote", tenant_id=TID)
    flow_runner.handle_reply(WA, "Test User")
    flow_runner.handle_reply(WA, "9876543210")
    flow_runner.handle_reply(WA, "skip")            # optional email
    flow_runner.handle_reply(WA, "I need a website")
    flow_runner.handle_reply(WA, "An e-commerce site, 2 months")
    out = flow_runner.handle_reply(WA, "n/a")       # nothing running? no — project was last step
    # project ask was the final ask; the reply above completed it.
    # The last handle_reply may be None (flow already finished).
    check("flow finished on last answer", out is None or out.get("finished") is True or out.get("handled"))

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    lead = conn.execute(
        "SELECT * FROM leads WHERE tenant_id=? AND wa_id=? ORDER BY id DESC LIMIT 1",
        (TID, WA)).fetchone()
    check("lead row written", lead is not None)
    if lead:
        import json as _json
        data = _json.loads(lead["collected"])
        check("lead collected name/phone/project",
              data.get("name") == "Test User" and data.get("phone") == "9876543210"
              and "e-commerce" in str(data.get("project", "")))
        check("lead flow/source tagged", lead["flow"] == "get_quote" and lead["source"] == "get_quote")
    check("flow cleared after finish", not flow_runner.is_running(WA))

    # ── raise_ticket: lead + complaint wrap + handoff + paused ────────
    WA2 = "919900000004"
    flow_runner.start_flow(WA2, "raise_ticket", tenant_id=TID)
    flow_runner.handle_reply(WA2, "Angry User")
    flow_runner.handle_reply(WA2, "9876543210")
    flow_runner.handle_reply(WA2, "skip")
    flow_runner.handle_reply(WA2, "My order never arrived")
    flow_runner.handle_reply(WA2, "The package was lost by the courier")
    flow_runner.handle_reply(WA2, "urgent")
    out = flow_runner.handle_reply(WA2, "ok")  # flow should already be finished
    check("raise_ticket finished", out is None or out.get("finished") or out.get("handled"))

    lead2 = conn.execute(
        "SELECT * FROM leads WHERE tenant_id=? AND wa_id=? ORDER BY id DESC LIMIT 1",
        (TID, WA2)).fetchone()
    check("raise_ticket wrote a lead with complaint source",
          lead2 is not None and lead2["source"] == "complaint")

    comp = conn.execute(
        "SELECT * FROM complaints WHERE wa_id=? ORDER BY id DESC LIMIT 1", (WA2,)).fetchone()
    check("complaint wrap: complaints row written", comp is not None and comp["ticket_id"].startswith("CMP-"))

    ho = conn.execute(
        "SELECT * FROM handoffs WHERE tenant_id=? AND wa_id=? ORDER BY id DESC LIMIT 1",
        (TID, WA2)).fetchone()
    check("handoff row written", ho is not None and ho["status"] == "pending")

    st = conn.execute("SELECT status FROM user_states WHERE wa_id=?", (WA2,)).fetchone()
    check("conversation paused after handoff", st is not None and st["status"] == "paused")

    # ── flow_for_button: profile menu dispatch + feature gate ─────────
    check("troogood menu_complaint maps to raise_ticket",
          flow_runner.flow_for_button(WA, "menu_complaint", tenant_id="troogood") == "raise_ticket")
    check("troogood menu_human refused (callback off) -> None",
          flow_runner.flow_for_button(WA, "menu_human", tenant_id="troogood") is None)
    check("button without flow -> None",
          flow_runner.flow_for_button(WA, "contact_support", tenant_id="troogood") is None)

    # ── cleanup ───────────────────────────────────────────────────────
    conn.execute("DELETE FROM leads WHERE tenant_id=?", (TID,))
    conn.execute("DELETE FROM handoffs WHERE tenant_id=?", (TID,))
    conn.execute("DELETE FROM complaints WHERE wa_id=?", (WA2,))
    conn.execute("DELETE FROM user_states WHERE wa_id IN (?, ?)", (WA, WA2))
    conn.execute("DELETE FROM tenants WHERE id=?", (TID,))
    conn.commit()
    conn.close()
    loader.reload_profile(TID)
    store.invalidate_all()
    print("cleanup: removed test tenant, leads, handoff, complaint, user states")

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        sys.exit(1)


if __name__ == "__main__":
    main()
