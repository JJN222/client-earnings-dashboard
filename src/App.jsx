import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const ACCENT = '#7DD3FC';
const ACCENT_DARK = '#0EA5E9';

// ============================================================
// UPDATE THIS DATA EACH MONTH - See instructions in README.md
// ============================================================
const INITIAL_DATA = {
  'January 2026': {
    youtube: [
      { channel: 'Dry Bar Comedy', revenue: 107263.88, views: 12238538, cpm: 7.337, rpm: 9.866, subscribers: 9892, watchHours: 2483777 },
      { channel: "Chance's Home World", revenue: 31140.94, views: 3030026, cpm: 10.169, rpm: 10.453, subscribers: 9358, watchHours: 331511 },
      { channel: 'Judge Faith', revenue: 27442.72, views: 1814882, cpm: 6.139, rpm: 15.694, subscribers: 1216, watchHours: 937731 },
      { channel: 'PBR', revenue: 22549.47, views: 12335120, cpm: 4.783, rpm: 2.634, subscribers: 12902, watchHours: 972735 },
      { channel: 'Casino King', revenue: 18549.79, views: 8073701, cpm: 8.545, rpm: 3.846, subscribers: 5532, watchHours: 357495 },
      { channel: 'ShowBizz The Adult', revenue: 14076.78, views: 4140193, cpm: 7.538, rpm: 4.752, subscribers: 1310, watchHours: 212392 },
      { channel: 'Still 400 - The Mannie & Juvie Show', revenue: 13398.79, views: 2167379, cpm: 6.455, rpm: 7.478, subscribers: 20279, watchHours: 346620 },
      { channel: 'ViralHog', revenue: 10150.42, views: 106704388, cpm: 4.059, rpm: 0.2, subscribers: -19148, watchHours: 338848 },
      { channel: 'Nick Norwitz', revenue: 7753.23, views: 7796794, cpm: 9.88, rpm: 4.612, subscribers: 50340, watchHours: 133203 },
      { channel: "Bein' Ian with Jordan Podcast", revenue: 5484.15, views: 448614, cpm: 6.881, rpm: 12.841, subscribers: 733, watchHours: 178269 },
      { channel: 'Tuesdays with Stories!', revenue: 4275.85, views: 1314129, cpm: 6.607, rpm: 4.589, subscribers: 559, watchHours: 189390 },
      { channel: 'Just Pranks', revenue: 3799.19, views: 1835641, cpm: 3.034, rpm: 2.07, subscribers: -943, watchHours: 294420 },
      { channel: 'Cutlers Court', revenue: 3741.01, views: 477293, cpm: 7.433, rpm: 8.807, subscribers: 882, watchHours: 67312 },
      { channel: "Brandon O'Brien", revenue: 3460.25, views: 6096690, cpm: 5.688, rpm: 0.915, subscribers: 1565, watchHours: 128385 },
      { channel: 'Thiccc Boy', revenue: 1948.37, views: 315119, cpm: 6.401, rpm: 7.14, subscribers: -96, watchHours: 65830 },
      { channel: 'Klem Family', revenue: 1754.91, views: 19945929, cpm: 3.927, rpm: 0.162, subscribers: -9657, watchHours: 199120 },
      { channel: 'ViralHog Vault', revenue: 308.97, views: 64174, cpm: 5.333, rpm: 4.869, subscribers: 110, watchHours: 7892 },
      { channel: 'A Little More Dry Bar', revenue: 306.24, views: 262755, cpm: 7.07, rpm: 2.672, subscribers: 133, watchHours: 5829 },
      { channel: 'Will Clarke', revenue: 211.20, views: 81202, cpm: 6.894, rpm: 3.743, subscribers: 337, watchHours: 6460 },
      { channel: 'Mireya Rios', revenue: 68.56, views: 2246686, cpm: 2.571, rpm: 0.064, subscribers: 367, watchHours: 6697 },
      { channel: 'Zhong en Français', revenue: 53.30, views: 38023, cpm: 3.978, rpm: 1.532, subscribers: -40, watchHours: 2397 },
      { channel: 'Janette Ok', revenue: 29.36, views: 23073, cpm: 4.443, rpm: 1.559, subscribers: -104, watchHours: 352 },
      { channel: 'Phaith Montoya', revenue: 3.42, views: 28562, cpm: 4.864, rpm: 0.237, subscribers: -167, watchHours: 95 },
    ],
    facebook: [
      { page: 'Celinaspookyboo', revenue: 41167.21, views: 107596233, rpm: 0.41, engagements: 9162821 },
      { page: 'Brave Wilderness', revenue: 1853.10, views: 5457612, rpm: 0.36, engagements: 283027 },
    ]
  }
};
// ============================================================

// Check URL for admin access
const getAdminFromURL = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    // CHANGE THIS PASSWORD to something secure!
    return params.get('admin') === 'true' || params.get('key') === 'shorthand2026';
  }
  return false;
};

// LocalStorage helpers
const STORAGE_KEY = 'clientEarningsData';

const loadFromStorage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return null;
};

const saveToStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
};

export default function App() {
  // Load from localStorage first, fall back to INITIAL_DATA
  const [allData, setAllData] = useState(() => {
    const saved = loadFromStorage();
    return saved || INITIAL_DATA;
  });
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = loadFromStorage();
    const data = saved || INITIAL_DATA;
    return Object.keys(data)[0] || 'January 2026';
  });
  
  const [activeTab, setActiveTab] = useState('overview');
  const [sortBy, setSortBy] = useState('revenue');
  const [sortOrder, setSortOrder] = useState('desc');
  const [dragOver, setDragOver] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [newMonthName, setNewMonthName] = useState('');
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('auto');
  const [isAdmin, setIsAdmin] = useState(getAdminFromURL());
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  // Check for admin access on mount
  useEffect(() => {
    setIsAdmin(getAdminFromURL());
  }, []);

  // Save to localStorage whenever data changes (admin only)
  useEffect(() => {
    if (isAdmin) {
      saveToStorage(allData);
    }
  }, [allData, isAdmin]);

  const handlePasswordSubmit = () => {
    // CHANGE THIS PASSWORD to something secure!
    if (passwordInput === 'shorthand2026') {
      setIsAdmin(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  // Export data as JSON for updating INITIAL_DATA
  const exportData = () => {
    const dataStr = JSON.stringify(allData, null, 2);
    navigator.clipboard.writeText(dataStr);
    setUploadStatus('✓ Data copied to clipboard!');
    setTimeout(() => setUploadStatus(''), 3000);
  };

  // Reset to initial data
  const resetData = () => {
    if (confirm('Reset all data to the default? This cannot be undone.')) {
      setAllData(INITIAL_DATA);
      setSelectedMonth(Object.keys(INITIAL_DATA)[0]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Get current month's data
  const youtubeData = allData[selectedMonth]?.youtube || [];
  const facebookData = allData[selectedMonth]?.facebook || [];
  const months = Object.keys(allData).sort();

  // CSV Parsers
  const parseYoutubeCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    const channelTitleIdx = headers.findIndex(h => h.includes('Channel title'));
    const revenueIdx = headers.findIndex(h => h.includes('Estimated partner revenue'));
    const viewsIdx = headers.findIndex(h => h === 'Views');
    const cpmIdx = headers.findIndex(h => h.includes('CPM (USD)') && !h.includes('Playback'));
    const rpmIdx = headers.findIndex(h => h.includes('RPM'));
    const subsIdx = headers.findIndex(h => h === 'Subscribers');
    const watchHoursIdx = headers.findIndex(h => h.includes('Watch time'));
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const channelTitle = values[channelTitleIdx];
      if (!channelTitle || channelTitle === 'Total' || channelTitle === '') continue;
      data.push({
        channel: channelTitle,
        revenue: parseFloat(values[revenueIdx]) || 0,
        views: parseInt(values[viewsIdx]) || 0,
        cpm: parseFloat(values[cpmIdx]) || 0,
        rpm: parseFloat(values[rpmIdx]) || 0,
        subscribers: parseInt(values[subsIdx]) || 0,
        watchHours: parseFloat(values[watchHoursIdx]) || 0
      });
    }
    return data.sort((a, b) => b.revenue - a.revenue);
  };

  const parseFacebookCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    const pageNameIdx = headers.findIndex(h => h.includes('Page name'));
    const contentMonetizationIdx = headers.findIndex(h => h.includes('Approximate content monetization'));
    const starsIdx = headers.findIndex(h => h.includes('stars earnings'));
    const viewsIdx = headers.findIndex(h => h.includes('Qualified Views'));
    const rpmIdx = headers.findIndex(h => h.includes('RPM'));
    const engagementsIdx = headers.findIndex(h => h.includes('Unique user engagements'));
    
    const pageData = new Map();
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
      const pageName = values[pageNameIdx];
      if (!pageName) continue;
      
      if (!pageData.has(pageName)) {
        pageData.set(pageName, { revenue: 0, views: 0, rpmSum: 0, rpmCount: 0, engagements: 0 });
      }
      const pd = pageData.get(pageName);
      pd.revenue += (parseFloat(values[contentMonetizationIdx]) || 0) + (parseFloat(values[starsIdx]) || 0);
      pd.views += parseInt(values[viewsIdx]) || 0;
      pd.rpmSum += parseFloat(values[rpmIdx]) || 0;
      pd.rpmCount += 1;
      pd.engagements += parseInt(values[engagementsIdx]) || 0;
    }
    
    return Array.from(pageData.entries())
      .map(([page, data]) => ({
        page,
        revenue: data.revenue,
        views: data.views,
        rpm: data.rpmCount > 0 ? data.rpmSum / data.rpmCount : 0,
        engagements: data.engagements
      }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  // Auto-detect file type
  const detectFileType = (text) => {
    const firstLine = text.split('\n')[0].toLowerCase();
    if (firstLine.includes('channel title') || firstLine.includes('estimated partner revenue')) {
      return 'youtube';
    }
    if (firstLine.includes('page name') || firstLine.includes('page id') || firstLine.includes('qualified views')) {
      return 'facebook';
    }
    return null;
  };

  // Process uploaded file
  const processFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      
      let fileType = selectedPlatform;
      if (fileType === 'auto') {
        fileType = detectFileType(text);
        if (!fileType) {
          setUploadStatus('Could not detect file type. Please select a platform manually.');
          return;
        }
      }

      let parsedData;
      if (fileType === 'youtube') {
        parsedData = parseYoutubeCSV(text);
        if (parsedData.length > 0) {
          setAllData(prev => ({
            ...prev,
            [selectedMonth]: {
              ...prev[selectedMonth],
              youtube: parsedData
            }
          }));
          setUploadStatus(`✓ Loaded ${parsedData.length} YouTube channels`);
        } else {
          setUploadStatus('No data found. Check that the file has the right columns.');
        }
      } else if (fileType === 'facebook') {
        parsedData = parseFacebookCSV(text);
        if (parsedData.length > 0) {
          setAllData(prev => ({
            ...prev,
            [selectedMonth]: {
              ...prev[selectedMonth],
              facebook: parsedData
            }
          }));
          setUploadStatus(`✓ Loaded ${parsedData.length} Facebook pages`);
        } else {
          setUploadStatus('No data found. Check that the file has the right columns.');
        }
      }
      
      setTimeout(() => setUploadStatus(''), 3000);
    };
    reader.readAsText(file);
  }, [selectedMonth, selectedPlatform]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.name.endsWith('.csv')) {
        processFile(file);
      }
    });
  }, [processFile]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(processFile);
  };

  // Add new month
  const addNewMonth = () => {
    if (newMonthName && !allData[newMonthName]) {
      setAllData(prev => ({
        ...prev,
        [newMonthName]: { youtube: [], facebook: [] }
      }));
      setSelectedMonth(newMonthName);
      setNewMonthName('');
      setShowAddMonth(false);
    }
  };

  // Delete month
  const deleteMonth = (month) => {
    if (months.length > 1 && confirm(`Delete ${month} data?`)) {
      setAllData(prev => {
        const newData = { ...prev };
        delete newData[month];
        return newData;
      });
      if (selectedMonth === month) {
        setSelectedMonth(months.find(m => m !== month));
      }
    }
  };

  // Calculations
  const combinedData = useMemo(() => {
    const clientMap = new Map();
    youtubeData.forEach(item => {
      const name = item.channel;
      if (!clientMap.has(name)) clientMap.set(name, { name, youtube: 0, facebook: 0, total: 0 });
      clientMap.get(name).youtube = item.revenue;
      clientMap.get(name).total += item.revenue;
    });
    facebookData.forEach(item => {
      const name = item.page;
      if (!clientMap.has(name)) clientMap.set(name, { name, youtube: 0, facebook: 0, total: 0 });
      clientMap.get(name).facebook = item.revenue;
      clientMap.get(name).total += item.revenue;
    });
    return Array.from(clientMap.values()).sort((a, b) => b.total - a.total);
  }, [youtubeData, facebookData]);

  const totals = useMemo(() => {
    const ytRevenue = youtubeData.reduce((sum, d) => sum + d.revenue, 0);
    const fbRevenue = facebookData.reduce((sum, d) => sum + d.revenue, 0);
    const ytViews = youtubeData.reduce((sum, d) => sum + d.views, 0);
    const fbViews = facebookData.reduce((sum, d) => sum + d.views, 0);
    return {
      totalRevenue: ytRevenue + fbRevenue,
      youtubeRevenue: ytRevenue,
      facebookRevenue: fbRevenue,
      totalViews: ytViews + fbViews,
    };
  }, [youtubeData, facebookData]);

  // Monthly trend data
  const trendData = useMemo(() => {
    return months.map(month => {
      const yt = allData[month]?.youtube || [];
      const fb = allData[month]?.facebook || [];
      return {
        month: month.replace(' 20', ' \''),
        youtube: yt.reduce((sum, d) => sum + d.revenue, 0),
        facebook: fb.reduce((sum, d) => sum + d.revenue, 0),
        total: yt.reduce((sum, d) => sum + d.revenue, 0) + fb.reduce((sum, d) => sum + d.revenue, 0)
      };
    });
  }, [allData, months]);

  const sortedYoutubeData = useMemo(() => {
    return [...youtubeData].sort((a, b) => {
      const mult = sortOrder === 'desc' ? -1 : 1;
      return mult * (a[sortBy] - b[sortBy]);
    });
  }, [youtubeData, sortBy, sortOrder]);

  const sortedFacebookData = useMemo(() => {
    return [...facebookData].sort((a, b) => {
      const mult = sortOrder === 'desc' ? -1 : 1;
      return mult * ((a[sortBy] || 0) - (b[sortBy] || 0));
    });
  }, [facebookData, sortBy, sortOrder]);

  const top10Revenue = combinedData.slice(0, 10);
  const platformBreakdown = [
    { name: 'YouTube', value: totals.youtubeRevenue },
    { name: 'Facebook', value: totals.facebookRevenue }
  ];

  const formatCurrency = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(2)}`;
  };

  const formatNumber = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toLocaleString();
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: '#FFFFFF',
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#1a1a1a',
      padding: '48px 64px',
      maxWidth: '1400px',
      margin: '0 auto'
    },
    header: { marginBottom: '48px' },
    title: {
      fontSize: '48px',
      fontWeight: '700',
      margin: 0,
      letterSpacing: '-1px',
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px'
    },
    dot: {
      width: '12px',
      height: '12px',
      background: ACCENT,
      borderRadius: '50%',
      display: 'inline-block'
    },
    subtitle: {
      color: '#666',
      marginTop: '8px',
      fontSize: '16px'
    },
    adminBanner: {
      background: '#fef3c7',
      border: '1px solid #f59e0b',
      borderRadius: '8px',
      padding: '12px 20px',
      marginBottom: '24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '14px'
    },
    monthSelector: {
      display: 'flex',
      gap: '12px',
      marginBottom: '32px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    monthPill: (active) => ({
      padding: '8px 16px',
      borderRadius: '100px',
      border: active ? 'none' : '1px solid #ddd',
      background: active ? '#1a1a1a' : 'transparent',
      color: active ? '#fff' : '#666',
      fontWeight: '500',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }),
    addMonthBtn: {
      padding: '8px 16px',
      borderRadius: '100px',
      border: '1px dashed #ddd',
      background: 'transparent',
      color: '#999',
      cursor: 'pointer',
      fontSize: '14px'
    },
    dropZone: (isDragOver) => ({
      border: `2px dashed ${isDragOver ? ACCENT_DARK : '#ddd'}`,
      borderRadius: '12px',
      padding: '40px',
      textAlign: 'center',
      marginBottom: '48px',
      background: isDragOver ? '#f0f9ff' : '#fafafa',
      transition: 'all 0.2s'
    }),
    dropZoneTitle: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '8px'
    },
    dropZoneText: {
      color: '#666',
      fontSize: '14px',
      marginBottom: '16px'
    },
    fileInput: {
      display: 'none'
    },
    uploadBtn: {
      padding: '10px 24px',
      borderRadius: '8px',
      border: 'none',
      background: ACCENT,
      color: '#0c4a6e',
      fontWeight: '500',
      cursor: 'pointer',
      fontSize: '14px'
    },
    statusMessage: {
      marginTop: '12px',
      fontSize: '14px',
      color: ACCENT_DARK,
      fontWeight: '500'
    },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '0',
      marginBottom: '48px',
      borderTop: '1px solid #eee',
      borderBottom: '1px solid #eee'
    },
    metricCard: {
      padding: '32px 0',
      borderRight: '1px solid #eee'
    },
    metricNumber: {
      fontSize: '14px',
      color: ACCENT,
      fontWeight: '500',
      marginBottom: '8px'
    },
    metricValue: {
      fontSize: '32px',
      fontWeight: '700',
      marginBottom: '4px'
    },
    metricLabel: {
      fontSize: '14px',
      color: '#666'
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '48px'
    },
    tab: (active) => ({
      padding: '12px 24px',
      borderRadius: '100px',
      border: 'none',
      background: active ? ACCENT : 'transparent',
      color: active ? '#0c4a6e' : '#666',
      fontWeight: '500',
      cursor: 'pointer',
      fontSize: '14px'
    }),
    sectionTitle: {
      fontSize: '28px',
      fontWeight: '700',
      marginBottom: '8px'
    },
    sectionSubtitle: {
      color: '#666',
      marginBottom: '32px',
      fontSize: '15px'
    },
    chartsRow: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: '64px',
      marginBottom: '64px'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '14px'
    },
    th: {
      textAlign: 'left',
      padding: '16px 12px',
      borderBottom: '2px solid #1a1a1a',
      fontWeight: '600',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: '#666'
    },
    thRight: {
      textAlign: 'right',
      padding: '16px 12px',
      borderBottom: '2px solid #1a1a1a',
      fontWeight: '600',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: '#666'
    },
    td: {
      padding: '16px 12px',
      borderBottom: '1px solid #eee'
    },
    tdRight: {
      padding: '16px 12px',
      borderBottom: '1px solid #eee',
      textAlign: 'right'
    },
    rowNumber: {
      color: ACCENT,
      fontWeight: '500',
      fontSize: '14px',
      width: '48px'
    },
    sortControls: {
      display: 'flex',
      gap: '12px',
      marginBottom: '24px',
      alignItems: 'center'
    },
    select: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      background: '#fff',
      fontSize: '14px',
      color: '#1a1a1a',
      cursor: 'pointer'
    },
    modal: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: '#fff',
      padding: '32px',
      borderRadius: '12px',
      width: '400px',
      maxHeight: '80vh',
      overflow: 'auto'
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      fontSize: '16px',
      marginBottom: '16px',
      boxSizing: 'border-box'
    },
    textarea: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      fontSize: '12px',
      fontFamily: 'monospace',
      marginBottom: '16px',
      boxSizing: 'border-box',
      minHeight: '200px'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          Client Earnings<span style={styles.dot}></span>
        </h1>
        <p style={styles.subtitle}>
          {combinedData.length} clients across {platformBreakdown.filter(p => p.value > 0).length} platforms
        </p>
      </div>

      {/* Admin Banner */}
      {isAdmin && (
        <div style={styles.adminBanner}>
          <span>🔐 <strong>Admin Mode</strong> — Upload and manage data</span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={exportData} style={{ ...styles.select, padding: '6px 12px', fontSize: '13px' }}>
              Export Data
            </button>
            <button onClick={resetData} style={{ ...styles.select, padding: '6px 12px', fontSize: '13px', color: '#ef4444' }}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Month Selector */}
      <div style={styles.monthSelector}>
        {months.map(month => (
          <button
            key={month}
            onClick={() => setSelectedMonth(month)}
            style={styles.monthPill(selectedMonth === month)}
          >
            {month}
            {isAdmin && months.length > 1 && selectedMonth === month && (
              <span 
                onClick={(e) => { e.stopPropagation(); deleteMonth(month); }}
                style={{ marginLeft: '4px', opacity: 0.6, cursor: 'pointer' }}
              >×</span>
            )}
          </button>
        ))}
        {isAdmin && (
          <button onClick={() => setShowAddMonth(true)} style={styles.addMonthBtn}>
            + Add Month
          </button>
        )}
      </div>

      {/* Drop Zone - Admin Only */}
      {isAdmin && (
        <div
          style={styles.dropZone(dragOver)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div style={styles.dropZoneTitle}>Drop CSV files here</div>
          <div style={styles.dropZoneText}>
            Select a platform below, then drag your file or click to browse
          </div>
          
          {/* Platform Selector */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
            {[
              { id: 'auto', label: 'Auto-detect' },
              { id: 'youtube', label: 'YouTube' },
              { id: 'facebook', label: 'Facebook' },
            ].map(platform => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '100px',
                  border: selectedPlatform === platform.id ? 'none' : '1px solid #ddd',
                  background: selectedPlatform === platform.id ? '#1a1a1a' : '#fff',
                  color: selectedPlatform === platform.id ? '#fff' : '#666',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}
              >
                {platform.label}
              </button>
            ))}
          </div>

          <label>
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileSelect}
              style={styles.fileInput}
            />
            <span style={styles.uploadBtn}>Browse Files</span>
          </label>
          {uploadStatus && <div style={styles.statusMessage}>{uploadStatus}</div>}
        </div>
      )}

      {/* Key Metrics */}
      <div style={styles.metricsGrid}>
        {[
          { num: '01', value: formatCurrency(totals.totalRevenue), label: 'Total Revenue' },
          { num: '02', value: formatCurrency(totals.youtubeRevenue), label: 'YouTube Revenue' },
          { num: '03', value: formatCurrency(totals.facebookRevenue), label: 'Facebook Revenue' },
          { num: '04', value: formatNumber(totals.totalViews), label: 'Total Views' },
        ].map((metric, i) => (
          <div key={i} style={{ ...styles.metricCard, borderRight: i === 3 ? 'none' : '1px solid #eee' }}>
            <div style={styles.metricNumber}>{metric.num}</div>
            <div style={styles.metricValue}>{metric.value}</div>
            <div style={styles.metricLabel}>{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {['overview', 'youtube', 'facebook', 'trends'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={styles.tab(activeTab === tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <h2 style={styles.sectionTitle}>Revenue by Client</h2>
          <p style={styles.sectionSubtitle}>Top performers for {selectedMonth}</p>
          
          <div style={styles.chartsRow}>
            <div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={top10Revenue} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={formatCurrency} stroke="#999" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 13, fill: '#1a1a1a' }} stroke="#999" />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px' }} />
                  <Bar dataKey="youtube" stackId="a" fill="#1a1a1a" name="YouTube" />
                  <Bar dataKey="facebook" stackId="a" fill={ACCENT} name="Facebook" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '24px' }}>Platform Split</div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={platformBreakdown} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" stroke="none">
                    <Cell fill="#1a1a1a" />
                    <Cell fill={ACCENT} />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: '#1a1a1a', borderRadius: '2px' }}></div>
                  <span style={{ fontSize: '13px', color: '#666' }}>YouTube</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: ACCENT, borderRadius: '2px' }}></div>
                  <span style={{ fontSize: '13px', color: '#666' }}>Facebook</span>
                </div>
              </div>
            </div>
          </div>

          <h2 style={styles.sectionTitle}>All Clients</h2>
          <p style={styles.sectionSubtitle}>Complete revenue breakdown by platform</p>
          
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '48px' }}>#</th>
                <th style={styles.th}>Client</th>
                <th style={styles.thRight}>YouTube</th>
                <th style={styles.thRight}>Facebook</th>
                <th style={styles.thRight}>Total</th>
              </tr>
            </thead>
            <tbody>
              {combinedData.map((client, i) => (
                <tr key={i}>
                  <td style={{ ...styles.td, ...styles.rowNumber }}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={{ ...styles.td, fontWeight: '500' }}>{client.name}</td>
                  <td style={{ ...styles.tdRight, color: client.youtube > 0 ? '#1a1a1a' : '#ccc' }}>{formatCurrency(client.youtube)}</td>
                  <td style={{ ...styles.tdRight, color: client.facebook > 0 ? ACCENT_DARK : '#ccc' }}>{formatCurrency(client.facebook)}</td>
                  <td style={{ ...styles.tdRight, fontWeight: '600' }}>{formatCurrency(client.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#fafafa' }}>
                <td style={styles.td}></td>
                <td style={{ ...styles.td, fontWeight: '600' }}>Total</td>
                <td style={{ ...styles.tdRight, fontWeight: '600' }}>{formatCurrency(totals.youtubeRevenue)}</td>
                <td style={{ ...styles.tdRight, fontWeight: '600', color: ACCENT_DARK }}>{formatCurrency(totals.facebookRevenue)}</td>
                <td style={{ ...styles.tdRight, fontWeight: '700', fontSize: '16px' }}>{formatCurrency(totals.totalRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* YouTube Tab */}
      {activeTab === 'youtube' && (
        <div>
          <h2 style={styles.sectionTitle}>YouTube Channels</h2>
          <p style={styles.sectionSubtitle}>Detailed performance metrics for {selectedMonth}</p>

          <div style={styles.sortControls}>
            <span style={{ fontSize: '13px', color: '#999' }}>Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.select}>
              <option value="revenue">Revenue</option>
              <option value="views">Views</option>
              <option value="cpm">CPM</option>
              <option value="rpm">RPM</option>
              <option value="subscribers">Subscribers</option>
              <option value="watchHours">Watch Hours</option>
            </select>
            <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} style={{ ...styles.select, cursor: 'pointer' }}>
              {sortOrder === 'desc' ? '↓ Descending' : '↑ Ascending'}
            </button>
          </div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '48px' }}>#</th>
                <th style={styles.th}>Channel</th>
                <th style={styles.thRight}>Revenue</th>
                <th style={styles.thRight}>Views</th>
                <th style={styles.thRight}>CPM</th>
                <th style={styles.thRight}>RPM</th>
                <th style={styles.thRight}>Subscribers</th>
                <th style={styles.thRight}>Watch Hours</th>
              </tr>
            </thead>
            <tbody>
              {sortedYoutubeData.map((channel, i) => (
                <tr key={i}>
                  <td style={{ ...styles.td, ...styles.rowNumber }}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={{ ...styles.td, fontWeight: '500' }}>{channel.channel}</td>
                  <td style={{ ...styles.tdRight, fontWeight: '600' }}>{formatCurrency(channel.revenue)}</td>
                  <td style={styles.tdRight}>{formatNumber(channel.views)}</td>
                  <td style={styles.tdRight}>${channel.cpm.toFixed(2)}</td>
                  <td style={{ ...styles.tdRight, color: ACCENT_DARK }}>${channel.rpm.toFixed(2)}</td>
                  <td style={{ ...styles.tdRight, color: channel.subscribers >= 0 ? '#1a1a1a' : '#ef4444' }}>
                    {channel.subscribers >= 0 ? '+' : ''}{formatNumber(channel.subscribers)}
                  </td>
                  <td style={styles.tdRight}>{formatNumber(channel.watchHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Facebook Tab */}
      {activeTab === 'facebook' && (
        <div>
          <h2 style={styles.sectionTitle}>Facebook Pages</h2>
          <p style={styles.sectionSubtitle}>Monthly performance for {selectedMonth}</p>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '48px' }}>#</th>
                <th style={styles.th}>Page</th>
                <th style={styles.thRight}>Revenue</th>
                <th style={styles.thRight}>Qualified Views</th>
                <th style={styles.thRight}>Avg RPM</th>
                <th style={styles.thRight}>Engagements</th>
              </tr>
            </thead>
            <tbody>
              {sortedFacebookData.map((page, i) => (
                <tr key={i}>
                  <td style={{ ...styles.td, ...styles.rowNumber }}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={{ ...styles.td, fontWeight: '500' }}>{page.page}</td>
                  <td style={{ ...styles.tdRight, fontWeight: '600' }}>{formatCurrency(page.revenue)}</td>
                  <td style={styles.tdRight}>{formatNumber(page.views)}</td>
                  <td style={{ ...styles.tdRight, color: ACCENT_DARK }}>${page.rpm.toFixed(2)}</td>
                  <td style={styles.tdRight}>{formatNumber(page.engagements)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div>
          <h2 style={styles.sectionTitle}>Revenue Trends</h2>
          <p style={styles.sectionSubtitle}>Month-over-month performance</p>

          {trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" stroke="#999" tick={{ fontSize: 13 }} />
                <YAxis stroke="#999" tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="total" stroke="#1a1a1a" strokeWidth={2} name="Total" dot={{ fill: '#1a1a1a' }} />
                <Line type="monotone" dataKey="youtube" stroke="#666" strokeWidth={2} name="YouTube" dot={{ fill: '#666' }} />
                <Line type="monotone" dataKey="facebook" stroke={ACCENT_DARK} strokeWidth={2} name="Facebook" dot={{ fill: ACCENT_DARK }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '64px', color: '#999' }}>
              Add more months to see trends.
            </div>
          )}

          {trendData.length > 1 && (
            <table style={{ ...styles.table, marginTop: '48px' }}>
              <thead>
                <tr>
                  <th style={styles.th}>Month</th>
                  <th style={styles.thRight}>YouTube</th>
                  <th style={styles.thRight}>Facebook</th>
                  <th style={styles.thRight}>Total</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{row.month}</td>
                    <td style={styles.tdRight}>{formatCurrency(row.youtube)}</td>
                    <td style={{ ...styles.tdRight, color: ACCENT_DARK }}>{formatCurrency(row.facebook)}</td>
                    <td style={{ ...styles.tdRight, fontWeight: '600' }}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Month Modal - Admin Only */}
      {showAddMonth && isAdmin && (
        <div style={styles.modal} onClick={() => setShowAddMonth(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>Add New Month</h3>
            <input
              type="text"
              placeholder="e.g., February 2026"
              value={newMonthName}
              onChange={(e) => setNewMonthName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNewMonth()}
              style={styles.input}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={addNewMonth} style={{ ...styles.uploadBtn, flex: 1 }}>Add Month</button>
              <button onClick={() => setShowAddMonth(false)} style={{ ...styles.select, flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div style={styles.modal} onClick={() => setShowPasswordModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>Admin Access</h3>
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              style={styles.input}
              autoFocus
            />
            {passwordError && <div style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>{passwordError}</div>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handlePasswordSubmit} style={{ ...styles.uploadBtn, flex: 1 }}>Login</button>
              <button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(''); }} style={{ ...styles.select, flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '80px', paddingTop: '32px', borderTop: '1px solid #eee', color: '#999', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Client Earnings Dashboard</span>
        {isAdmin ? (
          <button 
            onClick={() => setIsAdmin(false)} 
            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '13px' }}
          >
            Exit Admin Mode
          </button>
        ) : (
          <button 
            onClick={() => setShowPasswordModal(true)} 
            style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '13px' }}
          >
            •
          </button>
        )}
      </div>
    </div>
  );
}
