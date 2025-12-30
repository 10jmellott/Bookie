import { loadIcon } from './icon-loader.js';

function renderFolder(node, isNested = false) {
  const folderDiv = document.createElement('div');
  folderDiv.className = 'folder' + (isNested ? ' nested' : '');
  const title = document.createElement('h2');
  title.className = 'folder-title';
  title.textContent = node.title;
  folderDiv.appendChild(title);
  if (node.children && node.children.length > 0) {
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

document.addEventListener('DOMContentLoaded', () => {
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

  refreshBookmarks();

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
