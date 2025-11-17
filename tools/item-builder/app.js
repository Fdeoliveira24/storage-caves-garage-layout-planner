const backendUrlInput = document.getElementById('backendUrl');
const productIdInput = document.getElementById('productId');
const spinnerIdInput = document.getElementById('spinnerId');
const apiOutput = document.getElementById('apiOutput');
const paletteAngleInput = document.getElementById('paletteAngle');
const canvasAngleInput = document.getElementById('canvasAngle');
const filenameBaseInput = document.getElementById('filenameBase');
const imageFormatSelect = document.getElementById('imageFormat');
const palettePathEl = document.getElementById('palettePath');
const canvasPathEl = document.getElementById('canvasPath');
const itemIdInput = document.getElementById('itemId');
const itemLabelInput = document.getElementById('itemLabel');
const lengthFtInput = document.getElementById('lengthFt');
const widthFtInput = document.getElementById('widthFt');
const itemCategorySelect = document.getElementById('itemCategory');
const itemTagsInput = document.getElementById('itemTags');
const snippetOutput = document.getElementById('snippetOutput');

const state = {
  palettePath: null,
  canvasPath: null,
};

function logOutput(data) {
  apiOutput.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function getBackendUrl() {
  return backendUrlInput.value.trim().replace(/\/$/, '');
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
  return response.json();
}

document.getElementById('fetchProduct').addEventListener('click', async () => {
  const productId = productIdInput.value.trim();
  if (!productId) {
    return logOutput('Enter a product ID first.');
  }
  try {
    logOutput('Loading product...');
    const data = await fetchJson(`${getBackendUrl()}/ps/product/${productId}`);
    logOutput(data);
  } catch (error) {
    logOutput(error.message);
  }
});

document.getElementById('fetchSpinner').addEventListener('click', async () => {
  const productId = productIdInput.value.trim();
  const spinnerId = spinnerIdInput.value.trim();
  if (!productId || !spinnerId) {
    return logOutput('Enter both product ID and spinner ID.');
  }
  try {
    logOutput('Loading spinner...');
    const params = new URLSearchParams({ spinnerId });
    const data = await fetchJson(`${getBackendUrl()}/ps/product/${productId}/spinner?${params}`);
    logOutput(data);
  } catch (error) {
    logOutput(error.message);
  }
});

async function downloadRender(target) {
  const productId = productIdInput.value.trim();
  const angleInput = target === 'palette' ? paletteAngleInput : canvasAngleInput;
  const angleId = angleInput.value.trim();
  const filenameBase = filenameBaseInput.value.trim();

  if (!productId || !angleId || !filenameBase) {
    alert('Please enter product ID, angle IDs, and filename base first.');
    return;
  }

  try {
    const payload = {
      productId,
      angleId,
      format: imageFormatSelect.value,
      target,
      filenameBase,
    };
    logOutput(`Downloading ${target} render...`);
    const result = await fetchJson(`${getBackendUrl()}/ps/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    state[`${target}Path`] = result.relativePath;
    if (!itemIdInput.value) {
      itemIdInput.value = payload.filenameBase.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }

    if (target === 'palette') {
      palettePathEl.textContent = result.relativePath;
    } else {
      canvasPathEl.textContent = result.relativePath;
    }

    logOutput(result);
  } catch (error) {
    logOutput(error.message);
  }
}

document.getElementById('downloadPalette').addEventListener('click', () => downloadRender('palette'));
document.getElementById('downloadCanvas').addEventListener('click', () => downloadRender('canvas'));

document.getElementById('generateSnippet').addEventListener('click', () => {
  if (!state.palettePath || !state.canvasPath) {
    alert('Download both palette and canvas images first.');
    return;
  }

  const id = itemIdInput.value.trim();
  const label = itemLabelInput.value.trim();
  const lengthFt = parseFloat(lengthFtInput.value) || 0;
  const widthFt = parseFloat(widthFtInput.value) || 0;
  const category = itemCategorySelect.value;
  const tags = itemTagsInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!id || !label) {
    alert('Provide both ID and label.');
    return;
  }

  const snippet = {
    id,
    label,
    lengthFt,
    widthFt,
    color: '#94A3B8',
    category,
    paletteImage: state.palettePath,
    canvasImage: state.canvasPath,
  };

  if (tags.length) {
    snippet.tags = tags;
  }

  snippetOutput.textContent = JSON.stringify(snippet, null, 2);
});
