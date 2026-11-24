"""Non-destructive signed-in subscription status check.
Run after selecting an app account with lovable auth-session.
"""
import argparse
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from lovable_playwright_defaults import signed_in_context

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--status', required=True)
    args = parser.parse_args()
    screenshots = Path('/tmp/browser/household-subscription')
    screenshots.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await signed_in_context(browser)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto('http://localhost:8080', wait_until='networkidle')
        await page.get_by_role('button', name='Profile settings', exact=True).click()
        sheet = page.get_by_role('dialog')
        await sheet.get_by_role('button', name='Subscription', exact=True).click()
        await sheet.get_by_role('status').filter(has_text=args.status).wait_for()
        await sheet.get_by_role('button', name='Refresh subscription status').click()
        await sheet.get_by_role('button', name='Refresh subscription status').wait_for(state='visible')
        await page.wait_for_timeout(1500)
        assert await sheet.get_by_role('status').inner_text() == args.status
        assert await sheet.get_by_text('One subscription covers every household member.', exact=True).count() == 1
        cache_contains_status = await page.evaluate('''() => {
          const raw = localStorage.getItem('bamboo:cache:v1');
          if (!raw) return false;
          const cache = JSON.parse(raw);
          return (cache.clientState?.queries ?? []).some(q => q.queryKey?.includes('household-subscription'));
        }''')
        assert not cache_contains_status, 'Subscription access must not be persisted in the offline cache'
        await sheet.screenshot(path=str(screenshots / 'status.png'))
        await sheet.get_by_role('link', name='Subscription information', exact=True).click()
        await page.wait_for_url('http://localhost:8080/subscription')
        await page.get_by_role('heading', name='Subscription information', exact=True).wait_for()
        await page.goto('http://localhost:8080', wait_until='networkidle')
        await page.get_by_label('Calendar', exact=True).click()
        assert await page.get_by_role('button', name='Profile settings', exact=True).count() == 1
        await page.screenshot(path=str(screenshots / 'calendar.png'))
        assert not errors, 'Unexpected browser errors'
        print('Signed-in household status and refresh verified; information link opens; Calendar remains accessible; subscription status is not cached offline; no browser errors.')
        await browser.close()

asyncio.run(main())
