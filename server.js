import express from 'express';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cron from 'node-cron';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// ============================================================
// CONFIGURATION
// ============================================================
const API_VERSION = 'v24.0';
const MICRO_DIVISOR = 100000000;

// YouTube / Google OAuth Config (set these in Railway environment variables)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/auth/google/callback`
  : 'https://client-earnings-dashboard-production.up.railway.app/auth/google/callback';
const CONTENT_OWNER_ID = process.env.YOUTUBE_CONTENT_OWNER_ID || 'FiOFge6WS8moYeS1Bduh6g';

// Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// ============================================================
// DATABASE CONNECTION
// ============================================================
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Database table ready');
  } catch (err) {
    console.error('❌ Database init error:', err.message);
  }
}

// ============================================================
// META API FETCH HELPERS
// ============================================================

async function fetchPages(systemToken) {
  const allPages = [];
  let url = `https://graph.facebook.com/${API_VERSION}/me/accounts?limit=100&access_token=${systemToken}`;
  
  while (url) {
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (data.data) allPages.push(...data.data);
    url = data.paging?.next || null;
  }
  
  return allPages;
}

async function fetchPageInsights(pageId, pageToken, metric, since, until) {
  const url = `https://graph.facebook.com/${API_VERSION}/${pageId}/insights?metric=${metric}&period=day&since=${since}&until=${until}&access_token=${pageToken}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    console.warn(`Error fetching ${metric} for page ${pageId}: ${data.error.message}`);
    return null;
  }
  return data.data?.[0]?.values || null;
}

function sumDailyValues(values, isRevenue = false) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, day) => {
    if (isRevenue) {
      const micro = day.value?.microAmount || 0;
      return sum + micro / MICRO_DIVISOR;
    }
    return sum + (day.value || 0);
  }, 0);
}

function getDailyValues(values, isRevenue = false) {
  if (!values || values.length === 0) return [];
  return values.map(day => {
    const date = day.end_time.split('T')[0];
    let value = 0;
    if (isRevenue) {
      value = (day.value?.microAmount || 0) / MICRO_DIVISOR;
    } else {
      value = day.value || 0;
    }
    return { date, value };
  });
}

// ============================================================
// FACEBOOK DATA FETCH
// ============================================================

async function fetchFacebookData(since, until, excludedPageIds = []) {
  console.log(`📊 Fetching Facebook data from ${since} to ${until}...`);
  
  const configResult = await pool.query("SELECT value FROM config WHERE key = 'metaApiConfig'");
  if (!configResult.rows.length || !configResult.rows[0].value?.systemToken) {
    throw new Error('Meta API token not configured');
  }
  const systemToken = configResult.rows[0].value.systemToken;
  
  const pages = await fetchPages(systemToken);
  console.log(`✓ Found ${pages.length} Facebook pages`);
  
  const results = [];
  const dailyTotals = {};
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageName = page.name;
    const pageId = page.id;
    const pageToken = page.access_token;
    
    if (excludedPageIds.includes(pageId)) continue;
    
    const revenueData = await fetchPageInsights(pageId, pageToken, 'content_monetization_earnings', since, until);
    const viewsData = await fetchPageInsights(pageId, pageToken, 'page_video_views', since, until);
    
    const revenue = sumDailyValues(revenueData, true);
    const views = sumDailyValues(viewsData, false);
    
    const dailyRevenue = getDailyValues(revenueData, true);
    const dailyViews = getDailyValues(viewsData, false);
    
    dailyRevenue.forEach(d => {
      if (!dailyTotals[d.date]) dailyTotals[d.date] = { date: d.date, revenue: 0, views: 0 };
      dailyTotals[d.date].revenue += d.value;
    });
    dailyViews.forEach(d => {
      if (!dailyTotals[d.date]) dailyTotals[d.date] = { date: d.date, revenue: 0, views: 0 };
      dailyTotals[d.date].views += d.value;
    });
    
    if (revenue > 0 || views > 0) {
      const rpm = views > 0 ? (revenue / views) * 1000 : 0;
      results.push({
        page: pageName,
        pageId: pageId,
        revenue: Math.round(revenue * 100) / 100,
        views: views,
        rpm: Math.round(rpm * 100) / 100,
        engagements: 0,
      });
      console.log(`  ✓ ${pageName}: $${revenue.toFixed(2)}, ${views.toLocaleString()} views`);
    }
    
    if (i < pages.length - 1) await new Promise(r => setTimeout(r, 150));
  }
  
  results.sort((a, b) => b.revenue - a.revenue);
  const dailyData = Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));
  
  return { pages: results, daily: dailyData };
}

// ============================================================
// YOUTUBE API HELPERS
// ============================================================

async function getYouTubeClient() {
  // Get stored refresh token
  const tokenResult = await pool.query("SELECT value FROM config WHERE key = 'youtubeTokens'");
  if (!tokenResult.rows.length || !tokenResult.rows[0].value?.refresh_token) {
    throw new Error('YouTube not authorized - please connect your account');
  }
  
  const tokens = tokenResult.rows[0].value;
  oauth2Client.setCredentials(tokens);
  
  // Refresh access token if needed
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60000) {
    console.log('Refreshing YouTube access token...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    
    // Save updated tokens
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['youtubeTokens', JSON.stringify(credentials)]
    );
  }
  
  return google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });
}

async function fetchYouTubeChannels() {
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  
  // Get all channels under the content owner
  const channels = [];
  let pageToken = null;
  
  do {
    const response = await youtube.channels.list({
      part: 'snippet,statistics',
      managedByMe: true,
      onBehalfOfContentOwner: CONTENT_OWNER_ID,
      maxResults: 50,
      pageToken: pageToken
    });
    
    if (response.data.items) {
      channels.push(...response.data.items);
    }
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  
  return channels;
}

async function fetchYouTubeData(startDate, endDate) {
  console.log(`📺 Fetching YouTube data from ${startDate} to ${endDate}...`);
  
  try {
    const analyticsClient = await getYouTubeClient();
    const channels = await fetchYouTubeChannels();
    console.log(`✓ Found ${channels.length} YouTube channels`);
    
    const results = [];
    const dailyTotals = {};
    
    for (const channel of channels) {
      const channelId = channel.id;
      const channelName = channel.snippet.title;
      
      try {
        // Fetch analytics for this channel
        const response = await analyticsClient.reports.query({
          ids: `contentOwner==${CONTENT_OWNER_ID}`,
          startDate: startDate,
          endDate: endDate,
          metrics: 'estimatedRevenue,views,estimatedMinutesWatched,subscribersGained,subscribersLost',
          dimensions: 'day',
          filters: `channel==${channelId}`,
          sort: 'day'
        });
        
        let totalRevenue = 0, totalViews = 0, totalWatchHours = 0, totalSubsGained = 0, totalSubsLost = 0;
        
        if (response.data.rows) {
          for (const row of response.data.rows) {
            const [date, revenue, views, minutes, subsGained, subsLost] = row;
            totalRevenue += revenue || 0;
            totalViews += views || 0;
            totalWatchHours += (minutes || 0) / 60;
            totalSubsGained += subsGained || 0;
            totalSubsLost += subsLost || 0;
            
            // Aggregate daily totals
            if (!dailyTotals[date]) {
              dailyTotals[date] = { date, revenue: 0, views: 0 };
            }
            dailyTotals[date].revenue += revenue || 0;
            dailyTotals[date].views += views || 0;
          }
        }
        
        if (totalRevenue > 0 || totalViews > 0) {
          const rpm = totalViews > 0 ? (totalRevenue / totalViews) * 1000 : 0;
          const cpm = totalViews > 0 ? (totalRevenue / (totalViews / 1000)) : 0;
          
          results.push({
            channel: channelName,
            channelId: channelId,
            revenue: Math.round(totalRevenue * 100) / 100,
            views: totalViews,
            rpm: Math.round(rpm * 1000) / 1000,
            cpm: Math.round(cpm * 1000) / 1000,
            watchHours: Math.round(totalWatchHours),
            subscribers: totalSubsGained - totalSubsLost
          });
          console.log(`  ✓ ${channelName}: $${totalRevenue.toFixed(2)}, ${totalViews.toLocaleString()} views`);
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 100));
        
      } catch (err) {
        console.warn(`  ⚠ Error fetching ${channelName}: ${err.message}`);
      }
    }
    
    results.sort((a, b) => b.revenue - a.revenue);
    const dailyData = Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));
    
    return { channels: results, daily: dailyData };
    
  } catch (err) {
    console.error('❌ YouTube fetch error:', err.message);
    throw err;
  }
}

// ============================================================
// SCHEDULED DATA REFRESH
// ============================================================

async function runDailyFetch() {
  console.log('🕐 Starting daily data fetch...');
  const now = new Date();
  
  try {
    const excludedResult = await pool.query("SELECT value FROM config WHERE key = 'excludedPageIds'");
    const excludedPages = excludedResult.rows[0]?.value || {};
    
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentMonthKey = `${monthNames[month]} ${year}`;
    
    // Date ranges
    const mtdSince = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const mtdUntil = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const l7dSince = sevenDaysAgo.toISOString().split('T')[0];
    const l7dUntil = now.toISOString().split('T')[0];
    
    const currentExcluded = excludedPages[currentMonthKey] || [];
    
    // === FETCH FACEBOOK ===
    let fbMtdData = { pages: [], daily: [] };
    let fbL7dData = { pages: [], daily: [] };
    try {
      fbMtdData = await fetchFacebookData(mtdSince, mtdUntil, currentExcluded);
      fbL7dData = await fetchFacebookData(l7dSince, l7dUntil, currentExcluded);
    } catch (err) {
      console.error('Facebook fetch error:', err.message);
    }
    
    // === FETCH YOUTUBE ===
    let ytMtdData = { channels: [], daily: [] };
    let ytL7dData = { channels: [], daily: [] };
    try {
      ytMtdData = await fetchYouTubeData(mtdSince, mtdUntil);
      ytL7dData = await fetchYouTubeData(l7dSince, l7dUntil);
    } catch (err) {
      console.error('YouTube fetch error:', err.message);
    }
    
    // === SAVE MTD DATA ===
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['mtdData', JSON.stringify({
        month: currentMonthKey,
        lastUpdated: now.toISOString(),
        facebook: fbMtdData.pages,
        facebookDaily: fbMtdData.daily,
        youtube: ytMtdData.channels,
        youtubeDaily: ytMtdData.daily
      })]
    );
    console.log(`✅ MTD data saved for ${currentMonthKey}`);
    
    // === SAVE LAST 7 DAYS DATA ===
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['last7DaysData', JSON.stringify({
        since: l7dSince,
        until: l7dUntil,
        lastUpdated: now.toISOString(),
        facebook: fbL7dData.pages,
        facebookDaily: fbL7dData.daily,
        youtube: ytL7dData.channels,
        youtubeDaily: ytL7dData.daily
      })]
    );
    console.log(`✅ Last 7 Days data saved (${l7dSince} to ${l7dUntil})`);
    
    console.log('🎉 Daily fetch complete!');
    
  } catch (err) {
    console.error('❌ Daily fetch error:', err.message);
  }
}

// ============================================================
// API ROUTES
// ============================================================

// Data CRUD
app.get('/api/data/:key', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM config WHERE key = $1', [req.params.key]);
    res.json({ value: result.rows[0]?.value || null });
  } catch (err) {
    console.error('GET error:', err.message);
    res.status(500).json({ error: 'Database read failed' });
  }
});

app.post('/api/data/:key', async (req, res) => {
  try {
    const { value } = req.body;
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(value)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST error:', err.message);
    res.status(500).json({ error: 'Database write failed' });
  }
});

app.delete('/api/data/:key', async (req, res) => {
  try {
    await pool.query('DELETE FROM config WHERE key = $1', [req.params.key]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE error:', err.message);
    res.status(500).json({ error: 'Database delete failed' });
  }
});

// Manual refresh
app.post('/api/refresh', async (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== 'shorthand2026') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    runDailyFetch();
    res.json({ success: true, message: 'Refresh started in background' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh status
app.get('/api/refresh-status', async (req, res) => {
  try {
    const mtdResult = await pool.query("SELECT value FROM config WHERE key = 'mtdData'");
    const l7dResult = await pool.query("SELECT value FROM config WHERE key = 'last7DaysData'");
    
    res.json({
      mtd: mtdResult.rows[0]?.value?.lastUpdated || null,
      last7Days: l7dResult.rows[0]?.value?.lastUpdated || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GOOGLE OAUTH ROUTES
// ============================================================

// Start OAuth flow
app.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
    'https://www.googleapis.com/auth/youtube.readonly'
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Force consent to get refresh token
  });
  
  res.redirect(authUrl);
});

// OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.send(`<h1>Authorization failed</h1><p>${error}</p><a href="/">Go back</a>`);
  }
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Save tokens to database
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['youtubeTokens', JSON.stringify(tokens)]
    );
    
    console.log('✅ YouTube OAuth tokens saved');
    
    res.send(`
      <html>
        <head><title>Success!</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>✅ YouTube Connected!</h1>
          <p>Your YouTube account has been successfully linked.</p>
          <p>You can now close this window and refresh the dashboard.</p>
          <a href="/" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #0EA5E9; color: white; text-decoration: none; border-radius: 8px;">Go to Dashboard</a>
        </body>
      </html>
    `);
    
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.send(`<h1>Authorization failed</h1><p>${err.message}</p><a href="/">Go back</a>`);
  }
});

// Check YouTube connection status
app.get('/api/youtube/status', async (req, res) => {
  try {
    const tokenResult = await pool.query("SELECT value FROM config WHERE key = 'youtubeTokens'");
    const connected = !!(tokenResult.rows[0]?.value?.refresh_token);
    res.json({ connected });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// Disconnect YouTube
app.post('/api/youtube/disconnect', async (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== 'shorthand2026') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    await pool.query("DELETE FROM config WHERE key = 'youtubeTokens'");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SERVE REACT APP
// ============================================================
app.use(express.static(join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// ============================================================
// START SERVER & CRON
// ============================================================
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📺 YouTube redirect URI: ${GOOGLE_REDIRECT_URI}`);
    
    // Schedule daily fetch at 6:00 AM Pacific
    cron.schedule('0 6 * * *', () => {
      console.log('⏰ Cron triggered: Running daily fetch');
      runDailyFetch();
    }, {
      timezone: 'America/Los_Angeles'
    });
    
    console.log('📅 Daily fetch scheduled for 6:00 AM Pacific');
  });
});
