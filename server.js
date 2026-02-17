        // 1. CAPTURE (Fast & Aggressive)
        browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage();
        
        // Tell the browser NOT to wait for 30 seconds
        page.setDefaultNavigationTimeout(60000); // Give it 60 seconds total

        await page.setViewportSize({ width: 1280, height: 720 });

        // THE FIX: Changed 'networkidle' to 'domcontentloaded'
        // This makes it 10x faster and stops the timeout error
        await page.goto(url, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });

        // Wait just 2 seconds for the basic images to show up
        await page.waitForTimeout(2000); 

        // Take the shot
        await page.screenshot({ path: shotPath, quality: 60 }); 
        await browser.close();
