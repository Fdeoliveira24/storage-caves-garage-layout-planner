require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(morgan('dev'));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PIXELSQUID_KEY_ID = process.env.PIXELSQUID_KEY_ID;
const PIXELSQUID_KEY_SECRET = process.env.PIXELSQUID_KEY_SECRET;
const PIXELSQUID_API_BASE = process.env.PIXELSQUID_API_BASE || 'https://api.pixelsquid.com/api';

if (!PIXELSQUID_KEY_ID || !PIXELSQUID_KEY_SECRET) {
  console.error('ERROR: Missing PIXELSQUID_KEY_ID or PIXELSQUID_KEY_SECRET in .env');
  process.exit(1);
}

function buildAuthHeader() {
  const credentials = Buffer.from(`${PIXELSQUID_KEY_ID}:${PIXELSQUID_KEY_SECRET}`).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
    Accept: 'application/vnd.api+json; com.pixelsquid.api.version=1',
  };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

app.get('/ps/product/:id', async (req, res) => {
  const { id } = req.params;
  try {
    console.log(`[PixelSquid] Fetching product: ${id}`);
    const response = await axios.get(`${PIXELSQUID_API_BASE}/products/${id}`, {
      headers: buildAuthHeader(),
    });
    res.json(response.data);
  } catch (error) {
    console.error('[PixelSquid] Error fetching product:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch product',
      message: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
  }
});

app.get('/ps/product/:id/spinner', async (req, res) => {
  const { id } = req.params;
  const { spinnerId } = req.query;

  if (!spinnerId) {
    return res.status(400).json({ error: 'Missing spinnerId query parameter' });
  }

  try {
    console.log(`[PixelSquid] Fetching spinner: ${id}/${spinnerId}`);
    const response = await axios.get(`${PIXELSQUID_API_BASE}/products/${id}/spinners/${spinnerId}`, {
      headers: buildAuthHeader(),
    });
    res.json(response.data);
  } catch (error) {
    console.error('[PixelSquid] Error fetching spinner:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch spinner',
      message: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
  }
});

app.post('/ps/download', async (req, res) => {
  const { productId, angleId, format, target, filenameBase } = req.body;

  if (!productId || !angleId || !format || !target || !filenameBase) {
    return res.status(400).json({
      error: 'Missing required fields: productId, angleId, format, target, filenameBase',
    });
  }

  if (!['palette', 'canvas'].includes(target)) {
    return res.status(400).json({ error: 'target must be "palette" or "canvas"' });
  }

  try {
    console.log(`[PixelSquid] Downloading ${target} for product ${productId}, angle ${angleId}`);

    const headers = {
      ...buildAuthHeader(),
      'Content-Type': 'application/vnd.api+json',
    };

    const linksResponse = await axios.post(
      `${PIXELSQUID_API_BASE}/products/${productId}/download_links`,
      {
        data: {
          type: 'download_links',
          attributes: {
            angle_id: angleId,
            format: format,
          },
        },
      },
      { headers }
    );

    const dlData = Array.isArray(linksResponse.data?.data)
      ? linksResponse.data.data[0]
      : linksResponse.data?.data;

    const downloadUrl = dlData?.attributes?.url;
    if (!downloadUrl) {
      throw new Error('No download URL returned from PixelSquid API');
    }

    const imageResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const projectRoot = path.resolve(__dirname, '../../');
    const targetSubfolder = target === 'palette' ? 'palette' : 'canvas';
    const saveDir = path.join(projectRoot, 'assets/images/items', targetSubfolder);
    const safeBase = slugify(filenameBase);
    const filename = `${safeBase}.png`;
    const savePath = path.join(saveDir, filename);

    ensureDir(saveDir);
    fs.writeFileSync(savePath, imageResponse.data);
    console.log(`[PixelSquid] Saved to: ${savePath}`);

    const relativePath = `assets/images/items/${targetSubfolder}/${filename}`;
    const itemSnippet = {
      id: safeBase,
      label: '<FILL_LABEL>',
      lengthFt: 0,
      widthFt: 0,
      paletteImage: target === 'palette' ? relativePath : '<DOWNLOAD_PALETTE_FIRST>',
      canvasImage: target === 'canvas' ? relativePath : '<DOWNLOAD_CANVAS_FIRST>',
      category: '<vehicle|storage|recreational|other>',
    };

    res.json({
      success: true,
      localPath: savePath,
      relativePath,
      target,
      filename,
      itemSnippet,
    });
  } catch (error) {
    console.error('[PixelSquid] Download error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to download image',
      message: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pixelsquid-backend' });
});

app.listen(PORT, () => {
  console.log(`\n✓ PixelSquid Backend running on http://localhost:${PORT}`);
  console.log(`✓ Using API base: ${PIXELSQUID_API_BASE}\n`);
});
