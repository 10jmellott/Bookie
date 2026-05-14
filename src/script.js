// Store expanded/collapsed state by folder id, persisted in browser.storage.local
let folderState = {};
let allFolders = [];

function saveFolderState() {
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    browser.storage.local.set({ folderState });
  }
}

function loadFolderState() {
  return new Promise(resolve => {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      browser.storage.local.get('folderState').then(data => {
        if (data && data.folderState) {
          folderState = data.folderState;
        }
        resolve();
      }).catch(() => resolve());
    } else {
      resolve();
    }
  });
}

function renderFolder(node, isNested = false) {
  const folderDiv = document.createElement('div');
  folderDiv.className = 'folder' + (isNested ? ' nested' : '');

  // Default: root expanded, nested collapsed
  if (!(node.id in folderState)) {
    folderState[node.id] = !isNested;
  }
  const expanded = folderState[node.id];

  const title = document.createElement('h2');
  title.className = 'folder-title';

  title.append(document.createTextNode(node.title));

  // Add expand/collapse chevron
  const chevron = document.createElement('span');
  chevron.className = 'chevron';
  chevron.textContent = expanded ? '[-]' : '[+]';
  chevron.style.marginRight = '8px';
  title.appendChild(chevron);

  // Make the entire title clickable
  title.addEventListener('click', (e) => {
    e.stopPropagation();
    folderState[node.id] = !folderState[node.id];
    saveFolderState();
    // Re-render the whole tree
    const root = document.getElementById('root');
    if (root) {
      // Save scroll position
      const scroll = root.scrollTop;
      refreshBookmarks();
      root.scrollTop = scroll;
    }
  });
  folderDiv.appendChild(title);

  // Add add-bookmark button
  const addBtn = document.createElement('button');
  addBtn.className = 'folder-add-btn';
  addBtn.textContent = '+';
  addBtn.title = 'Add bookmark to this folder';
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showAddBookmarkForm(e.target, node.id, node.title);
  });
  folderDiv.appendChild(addBtn);

  // Add bookmark form container
  const formContainer = document.createElement('div');
  formContainer.className = 'add-bookmark-form inline-form hidden';
  formContainer.innerHTML = `
    <input type="text" class="bookmark-input bookmark-title-input" placeholder="Title">
    <input type="url" class="bookmark-input bookmark-url-input" placeholder="https://example.com">
    <div class="inline-form-buttons">
      <button class="save-btn inline-save-btn">Save</button>
      <button class="cancel-btn inline-cancel-btn">Cancel</button>
    </div>
  `;
  folderDiv.appendChild(formContainer);

  // Children only rendered if expanded
  if (expanded && node.children && node.children.length > 0) {
    renderBookmarks(node.children, folderDiv, true);
  }
  return folderDiv;
}

function renderBookmarks(nodes, container, isNested = false) {
  nodes.forEach(node => {
    if (node.type === 'folder') {
      container.appendChild(renderFolder(node, isNested));
    } else if (node.type === 'bookmark') {
      container.appendChild(renderBookmark(node));
    }
  });
}

function renderBookmark(node) {
  const bookmarkDiv = document.createElement('div');
  bookmarkDiv.className = 'bookmark-container';

  const linkEl = document.createElement('a');
  linkEl.className = 'bookmark-row';
  linkEl.href = node.url;
  linkEl.target = '_blank';

  let hostLetter = '';
  const urlObj = new URL(node.url);
  // Extract the main domain (ignore subdomains)
  const hostParts = urlObj.hostname.split('.');
  if (hostParts.length >= 2) {
    // Use the first letter of the second-to-last part (main domain)
    hostLetter = hostParts[hostParts.length - 2][0];
  } else {
    hostLetter = urlObj.hostname[0];
  }

  const iconEl = document.createElement('span');
  iconEl.className = 'bookmark-favicon fallback';
  iconEl.innerText = hostLetter;
  linkEl.appendChild(iconEl);

  const titleEl = document.createElement('span');
  titleEl.className = 'bookmark';
  titleEl.textContent = node.title || node.url;
  linkEl.appendChild(titleEl);

  bookmarkDiv.appendChild(linkEl);

  // Add delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '×';
  deleteBtn.title = 'Delete bookmark';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm(`Delete bookmark "${node.title || node.url}"?`)) {
      browser.bookmarks.remove(node.id).then(() => {
        refreshBookmarks();
      }).catch(err => {
        console.error('Failed to delete bookmark:', err);
        alert('Failed to delete bookmark');
      });
    }
  });
  bookmarkDiv.appendChild(deleteBtn);

  return bookmarkDiv;
}

function findBookmarksMenu(nodes) {
  for (const node of nodes) {
    if (node.title === 'Bookmarks Menu' || node.title === 'Bookmarks Toolbar') {
      return node;
    }
    if (node.children) {
      const found = findBookmarksMenu(node.children);
      if (found) return found;
    }
  }
  return null;
}

function collectFolders(nodes, path = []) {
  const folders = [];
  nodes.forEach(node => {
    if (node.type === 'folder') {
      const folderPath = [...path, node.title];
      folders.push({
        id: node.id,
        title: node.title,
        path: folderPath.join(' > ')
      });
      if (node.children) {
        folders.push(...collectFolders(node.children, folderPath));
      }
    }
  });
  return folders;
}

function populateFolderSelect() {
  const select = document.getElementById('bookmark-folder');
  if (!select) return;
  select.innerHTML = '<option value="">Select folder (optional)</option>';
  
  allFolders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.path;
    select.appendChild(option);
  });
}

// Expose refreshBookmarks globally for chevron click
function refreshBookmarks() {
  browser.bookmarks.getTree().then(tree => {
    const menu = findBookmarksMenu(tree);
    const root = document.getElementById('root');
    root.innerHTML = '';
    if (menu && menu.children) {
      // Collect all folders for the dropdown
      allFolders = collectFolders(menu.children);
      populateFolderSelect();
      renderBookmarks(menu.children, root);
    } else {
      root.textContent = 'No bookmarks found.';
    }
  }).catch(err => {
    document.getElementById('root').textContent = 'Error reading bookmarks';
    console.error(err);
  });
}

function showAddBookmarkForm(targetElement, parentId, parentTitle) {
  const formContainer = targetElement.nextElementSibling;
  if (formContainer.classList.contains('hidden')) {
    // Hide any other open forms
    document.querySelectorAll('.add-bookmark-form.inline-form').forEach(form => {
      form.classList.add('hidden');
    });
    formContainer.classList.remove('hidden');
    formContainer.querySelector('.bookmark-title-input').focus();
  } else {
    formContainer.classList.add('hidden');
  }

  // Setup save button
  const saveBtn = formContainer.querySelector('.inline-save-btn');
  const cancelBtn = formContainer.querySelector('.inline-cancel-btn');
  const titleInput = formContainer.querySelector('.bookmark-title-input');
  const urlInput = formContainer.querySelector('.bookmark-url-input');

  // Remove old event listeners by cloning
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newSaveBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();

    if (!title || !url) {
      alert('Please enter both title and URL');
      return;
    }

    try {
      new URL(url);
    } catch (e) {
      alert('Please enter a valid URL');
      return;
    }

    browser.bookmarks.create({
      title,
      url,
      parentId
    }).then(() => {
      formContainer.classList.add('hidden');
      titleInput.value = '';
      urlInput.value = '';
      refreshBookmarks();
    }).catch(err => {
      console.error('Failed to create bookmark:', err);
      alert('Failed to create bookmark');
    });
  });

  newCancelBtn.addEventListener('click', () => {
    formContainer.classList.add('hidden');
    titleInput.value = '';
    urlInput.value = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadFolderState().then(() => {
    refreshBookmarks();
  });

  // Listen for bookmark changes and refresh
  const events = [
    'onCreated',
    'onRemoved',
    'onChanged',
    'onMoved',
    'onChildrenReordered',
  ];
  events.forEach(eventName => {
    if (browser.bookmarks[eventName]) {
      browser.bookmarks[eventName].addListener(refreshBookmarks);
    }
  });
});
