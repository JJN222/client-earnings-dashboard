import express from 'express';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// ============================================================
// META API CONSTANTS
// ============================================================
const API_VERSION = 'v24.0';
const MICRO_DIVISOR = 100000000;

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

// Fetch all pages from the system user token
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

// Fetch insights for a single page
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

// Sum daily values (handles both revenue microAmount and regular values)
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

// Get daily values as array (for last 7 days graph)
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
// FACEBOOK DATA FETCH FUNCTION
// ============================================================

async function fetchFacebookData(since, until, excludedPageIds = []) {
  console.log(`📊 Fetching Facebook data from ${since} to ${until}...`);
  
  // Get Meta API config from database
  const configResult = await pool.query("SELECT value FROM config WHERE key = 'metaApiConfig'");
  if (!configResult.rows.length || !configResult.rows[0].value?.systemToken) {
    throw new Error('Meta API token not configured');
  }
  const systemToken = configResult.rows[0].value.systemToken;
  
  // Fetch all pages
  const pages = await fetchPages(systemToken);
  console.log(`✓ Found ${pages.length} pages`);
  
  const results = [];
  const dailyTotals = {}; // For aggregating daily data
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageName = page.name;
    const pageId = page.id;
    const pageToken = page.access_token;
    
    // Skip excluded pages
    if (excludedPageIds.includes(pageId)) {
      continue;
    }
    
    // Fetch revenue
    const revenueData = await fetchPageInsights(
      pageId, pageToken, 'content_monetization_earnings',
      since, until
    );
    
    // Fetch views
    const viewsData = await fetchPageInsights(
      pageId, pageToken, 'page_video_views',
      since, until
    );
    
    const revenue = sumDailyValues(revenueData, true);
    const views = sumDailyValues(viewsData, false);
    
    // Get daily breakdown for the graph
    const dailyRevenue = getDailyValues(revenueData, true);
    const dailyViews = getDailyValues(viewsData, false);
    
    // Aggregate daily totals across all pages
    dailyRevenue.forEach(d => {
      if (!dailyTotals[d.date]) {
        dailyTotals[d.date] = { date: d.date, revenue: 0, views: 0 };
      }
      dailyTotals[d.date].revenue += d.value;
    });
    dailyViews.forEach(d => {
      if (!dailyTotals[d.date]) {
        dailyTotals[d.date] = { date: d.date, revenue: 0, views: 0 };
      }
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
    
    // Small delay to avoid rate limiting
    if (i < pages.length - 1) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  
  // Sort by revenue
  results.sort((a, b) => b.revenue - a.revenue);
  
  // Convert daily totals to sorted array
  const dailyData = Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));
  
  return { pages: results, daily: dailyData };
}

// ============================================================
// SCHEDULED DATA REFRESH
// ============================================================

async function runDailyFetch() {
  console.log('🕐 Starting daily Facebook data fetch...');
  const now = new Date();
  
  try {
    // Get excluded pages for current month
    const excludedResult = await pool.query("SELECT value FROM config WHERE key = 'excludedPageIds'");
    const excludedPages = excludedResult.rows[0]?.value || {};
    
    // === MONTH-TO-DATE ===
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentMonthKey = `${monthNames[month]} ${year}`;
    
    const mtdSince = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const mtdUntil = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const currentExcluded = excludedPages[currentMonthKey] || [];
    const mtdData = await fetchFacebookData(mtdSince, mtdUntil, currentExcluded);
    
    // Save MTD data
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['mtdData', JSON.stringify({
        month: currentMonthKey,
        lastUpdated: now.toISOString(),
        facebook: mtdData.pages,
        daily: mtdData.daily
      })]
    );
    console.log(`✅ MTD data saved for ${currentMonthKey}`);
    
    // === LAST 7 DAYS ===
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const l7dSince = sevenDaysAgo.toISOString().split('T')[0];
    const l7dUntil = now.toISOString().split('T')[0];
    
    // For last 7 days, use MTD exclusions
    const l7dData = await fetchFacebookData(l7dSince, l7dUntil, currentExcluded);
    
    // Save Last 7 Days data
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['last7DaysData', JSON.stringify({
        since: l7dSince,
        until: l7dUntil,
        lastUpdated: now.toISOString(),
        facebook: l7dData.pages,
        daily: l7dData.daily
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

// GET /api/data/:key - Read a config value
app.get('/api/data/:key', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM config WHERE key = $1', [req.params.key]);
    if (result.rows.length > 0) {
      res.json({ value: result.rows[0].value });
    } else {
      res.json({ value: null });
    }
  } catch (err) {
    console.error('GET error:', err.message);
    res.status(500).json({ error: 'Database read failed' });
  }
});

// POST /api/data/:key - Write a config value
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

// DELETE /api/data/:key - Delete a config value
app.delete('/api/data/:key', async (req, res) => {
  try {
    await pool.query('DELETE FROM config WHERE key = $1', [req.params.key]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE error:', err.message);
    res.status(500).json({ error: 'Database delete failed' });
  }
});

// POST /api/refresh - Manually trigger data refresh (admin only)
app.post('/api/refresh', async (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== 'shorthand2026') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    // Run in background, don't wait
    runDailyFetch();
    res.json({ success: true, message: 'Refresh started in background' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/refresh-status - Check last refresh time
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
    
    // Schedule daily fetch at 6:00 AM Pacific Time
    cron.schedule('0 6 * * *', () => {
      console.log('⏰ Cron triggered: Running daily fetch');
      runDailyFetch();
    }, {
      timezone: 'America/Los_Angeles'
    });
    
    console.log('📅 Daily fetch scheduled for 6:00 AM Pacific');
  });
});
