// ... (keep the beginning of the file the same)

    // ============================================
    // STEP 2: CREATE AESTHETIC COLLAGE
    // ============================================
    console.log('[STEP 2] Creating aesthetic collage...');
    
    // THE FIX: We resize the screenshot FIRST so it's not too big for the canvas
    const screenshotBuffer = await fs.readFile(screenshotPath);
    const colors = await extractDominantColors(screenshotBuffer);
    
    const canvasWidth = 1080;
    const canvasHeight = 1920;
    
    // We create a "Mobile-sized" version of the screenshot for the collage
    const resizedScreenshot = await sharp(screenshotBuffer)
      .resize(800, 1400, { // Shrink it to fit nicely
        fit: 'cover',
        position: 'top' // Keep the top of the website visible
      })
      .toBuffer();

    // ... (rest of the collage code)

    const collage = await sharp(gradient) // This is the background
      .composite([{
        input: resizedScreenshot, // Use the SHRUNK version
        gravity: 'center'
      }])
      .png()
      .toBuffer();
