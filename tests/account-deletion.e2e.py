"""Destructive check for disposable accounts only; never pass a real user's session.

Run with a session created by lovable auth-session --create-test-user and
disposable fixtures in the database. Screenshots remain under /tmp/browser.
"""
import argparse
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

APP = "http://localhost:8080"

async def check(session_path: str, mode: str):
    saved = json.loads(Path(session_path).read_text())
    session = saved["session"]
    email = session["user"]["email"]
    user_id = session["user"]["id"]
    if not email.startswith("agent-test+") or not email.endswith("@example.com"):
        raise RuntimeError("This test refuses non-disposable accounts")
    output = Path("/tmp/browser/store-readiness")
    output.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width":384,"height":705}, storage_state={
            "cookies": [{**cookie, "url":APP} for cookie in saved.get("cookies") or []],
            "origins": [{"origin":APP,"localStorage":[{"name":saved["storage_key"],"value":json.dumps(session)}]}],
        })
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto(APP + "/delete-account", wait_until="networkidle")
        await page.get_by_text("Signed in as " + email, exact=True).wait_for()
        # A real upload proves storage cleanup, not just empty-account deletion.
        upload = await page.evaluate("""async ({userId,mode}) => {
            const {supabase} = await import('/src/integrations/supabase/client.ts');
            const bucket = mode === 'owner' ? 'documents' : 'memory-photos';
            const path = `${userId}/deletion-check.txt`;
            const {error} = await supabase.storage.from(bucket).upload(path,new Blob(['disposable test content']),{contentType:'text/plain',upsert:true});
            return {ok:!error,message:error?.message ?? ''};
        }""", {"userId":user_id,"mode":mode})
        if not upload["ok"]:
            raise RuntimeError("Disposable upload failed: " + upload["message"])
        await page.get_by_role("button",name="Delete my account",exact=True).click()
        dialog = page.get_by_role("alertdialog")
        await dialog.wait_for()
        delete = dialog.get_by_role("button",name="Delete permanently",exact=True)
        checkbox = dialog.get_by_role("checkbox")
        await checkbox.wait_for()
        assert await delete.is_disabled(), "Deletion must require explicit confirmation"
        if mode == "owner":
            await dialog.get_by_text("Your household profiles",exact=False).wait_for()
        else:
            await dialog.get_by_text("Your sign-in account and personal records",exact=False).wait_for()
        await checkbox.check()
        await delete.wait_for(state="visible")
        await page.wait_for_function("""() => {
            const buttons=[...document.querySelectorAll('[role=alertdialog] button')];
            return buttons.some(b=>b.textContent==='Delete permanently'&&!b.disabled);
        }""")
        await dialog.screenshot(path=str(output / (mode+"-confirmation.png")))
        await delete.click()
        await page.wait_for_url(APP + "/account-deleted",timeout=30000)
        await page.get_by_role("heading",name="Account deleted",exact=True).wait_for()
        assert await page.get_by_role("link",name="Manage store billing",exact=True).count()==1
        assert await page.evaluate("localStorage.getItem('bamboo:offline-queue:v1') === null")
        assert await page.evaluate("!localStorage.getItem('bamboo:cache:v1')?.includes('private content')")
        await page.screenshot(path=str(output / (mode+"-deleted.png")))
        assert not errors, errors
        print(mode + " deletion verified through the signed-in UI, with a real uploaded file and explicit confirmation")
        await browser.close()

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--session",required=True)
    parser.add_argument("--mode",choices=["member","owner"],required=True)
    args=parser.parse_args()
    asyncio.run(check(args.session,args.mode))