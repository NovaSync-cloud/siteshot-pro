import React, { useState } from 'react';

const App = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleGenerate = async (type) => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid URL (include http:// or https://)');
      return;
    }

    setError('');
    setLoading(true);
    setPreview(null);
    
    const taskNames = {
      full: 'Capturing full page screenshot...',
      collage: 'Creating aesthetic collage...',
      video: 'Generating scrolling video (this may take 2-3 minutes)...'
    };
    
    setCurrentTask(taskNames[type]);

    try {
      const endpoint = type === 'full' 
        ? '/api/screenshot/full'
        : type === 'collage'
        ? '/api/screenshot/collage'
        : '/api/video/scroll';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      setPreview({
        url: objectUrl,
        type: type === 'video' ? 'video' : 'image',
        filename: type === 'video' ? 'scroll-video.mp4' : `screenshot-${type}.png`
      });

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to generate asset. Please try again.');
    } finally {
      setLoading(false);
      setCurrentTask('');
    }
  };

  const handleDownload = () => {
    if (!preview) return;
    
    const a = document.createElement('a');
    a.href = preview.url;
    a.download = preview.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>📸</div>
          <h1 style={styles.logoText}>SiteShot Pro</h1>
        </div>
        <p style={styles.subtitle}>Generate stunning marketing assets from any URL</p>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {/* Input Card */}
        <div style={styles.card}>
          <label style={styles.label}>Website URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            style={styles.input}
            disabled={loading}
          />
          
          {error && (
            <div style={styles.error}>
              ⚠️ {error}
            </div>
          )}

          {/* Action Buttons */}
          <div style={styles.buttonGrid}>
            <button
              onClick={() => handleGenerate('full')}
              disabled={loading}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(loading ? styles.buttonDisabled : {})
              }}
            >
              <span style={styles.buttonIcon}>🖼️</span>
              <div>
                <div style={styles.buttonTitle}>Full Screenshot</div>
                <div style={styles.buttonDesc}>Entire webpage</div>
              </div>
            </button>

            <button
              onClick={() => handleGenerate('collage')}
              disabled={loading}
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                ...(loading ? styles.buttonDisabled : {})
              }}
            >
              <span style={styles.buttonIcon}>✨</span>
              <div>
                <div style={styles.buttonTitle}>Aesthetic Collage</div>
                <div style={styles.buttonDesc}>Vision board style</div>
              </div>
            </button>

            <button
              onClick={() => handleGenerate('video')}
              disabled={loading}
              style={{
                ...styles.button,
                ...styles.buttonAccent,
                ...(loading ? styles.buttonDisabled : {})
              }}
            >
              <span style={styles.buttonIcon}>🎬</span>
              <div>
                <div style={styles.buttonTitle}>Scrolling Video</div>
                <div style={styles.buttonDesc}>10-sec animation</div>
              </div>
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>{currentTask}</p>
              <p style={styles.loadingSubtext}>Please wait, this runs on free hosting...</p>
            </div>
          )}
        </div>

        {/* Preview Card */}
        {preview && !loading && (
          <div style={styles.card}>
            <div style={styles.previewHeader}>
              <h3 style={styles.previewTitle}>✅ Generated Successfully!</h3>
              <button onClick={handleDownload} style={styles.downloadButton}>
                ⬇️ Download
              </button>
            </div>

            <div style={styles.previewContainer}>
              {preview.type === 'image' ? (
                <img 
                  src={preview.url} 
                  alt="Generated screenshot" 
                  style={styles.previewImage}
                />
              ) : (
                <video 
                  src={preview.url} 
                  controls 
                  autoPlay 
                  loop 
                  style={styles.previewVideo}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <p style={styles.footerText}>
          Powered by Playwright + FFmpeg • Hosted on Render Free Tier (512MB RAM)
        </p>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
    paddingTop: '40px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '10px',
  },
  logoIcon: {
    fontSize: '48px',
  },
  logoText: {
    fontSize: '42px',
    fontWeight: '800',
    color: 'white',
    margin: 0,
    textShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  subtitle: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.9)',
    margin: 0,
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '20px',
    padding: '40px',
    marginBottom: '30px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(10px)',
  },
  label: {
    display: 'block',
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '10px',
  },
  input: {
    width: '100%',
    padding: '16px 20px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.3s',
    boxSizing: 'border-box',
  },
  error: {
    marginTop: '15px',
    padding: '12px 16px',
    background: '#fee',
    color: '#c33',
    borderRadius: '8px',
    fontSize: '14px',
  },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginTop: '30px',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '20px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s',
    textAlign: 'left',
  },
  buttonPrimary: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  buttonSecondary: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: 'white',
  },
  buttonAccent: {
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: 'white',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  buttonIcon: {
    fontSize: '32px',
  },
  buttonTitle: {
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '4px',
  },
  buttonDesc: {
    fontSize: '13px',
    opacity: 0.9,
  },
  loadingContainer: {
    marginTop: '40px',
    textAlign: 'center',
    padding: '40px 20px',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  loadingText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    margin: '0 0 8px 0',
  },
  loadingSubtext: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  previewTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#333',
    margin: 0,
  },
  downloadButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  previewContainer: {
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#f5f5f5',
  },
  previewImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  previewVideo: {
    width: '100%',
    height: 'auto',
    display: 'block',
    maxHeight: '70vh',
  },
  footer: {
    textAlign: 'center',
    marginTop: '40px',
    paddingBottom: '40px',
  },
  footerText: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
    margin: 0,
  },
};

// Add keyframe animation
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`, styleSheet.cssRules.length);

export default App;
