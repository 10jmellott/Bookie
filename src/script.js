// Store expanded/collapsed state by folder id, persisted in browser.storage.local
let folderState = {};

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

  // Children only rendered if expanded (already implemented)
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

  return linkEl;
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

// Expose refreshBookmarks globally for chevron click
function refreshBookmarks() {
  browser.bookmarks.getTree().then(tree => {
    const menu = findBookmarksMenu(tree);
    const root = document.getElementById('root');
    root.innerHTML = '';
    if (menu && menu.children) {
      renderBookmarks(menu.children, root);
    } else {
      root.textContent = 'No bookmarks found.';
    }
  }).catch(err => {
    document.getElementById('root').textContent = 'Error reading bookmarks';
    console.error(err);
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
