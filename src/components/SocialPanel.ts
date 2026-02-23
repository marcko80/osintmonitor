// =============================================================================
// SocialPanel — Social Monitoring panel for OSINTmonitor
// Extends the base Panel class. Three sub-views: Feed, Sources, Assets.
// Uses h() hyperscript for DOM construction (matches project convention).
// =============================================================================

import { Panel } from './Panel';
import { h, replaceChildren } from '../utils/dom-utils';
import type { SocialMessage, SocialSource, SocialAsset, SocialPanelView } from '@/types/social';
import {
  getSources,
  getAssets,
  getFilteredMessages,
  createSource,
  deleteSource,
  createAsset,
  deleteAsset,
  generateMockMessages,
  addMessages,
  initMockSources,
  clearMessages,
  savePanelState,
  getPanelState,
} from '@/services/social';

export class SocialPanel extends Panel {
  private currentView: SocialPanelView = 'feed';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor() {
    super({
      id: 'social',
      title: 'Social Monitor',
      showCount: true,
      className: 'social-panel',
    });
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Initialize mock sources on first run
    initMockSources();

    // Restore saved view
    const state = getPanelState();
    this.currentView = state.view || 'feed';

    // Load initial mock data if empty
    const msgs = getFilteredMessages();
    if (msgs.length === 0) {
      const mockMsgs = generateMockMessages(15);
      addMessages(mockMsgs);
    }

    this.render();
  }

  private render(): void {
    const toolbar = this.buildToolbar();
    let body: HTMLElement;

    switch (this.currentView) {
      case 'sources':
        body = this.buildSourcesView();
        break;
      case 'assets':
        body = this.buildAssetsView();
        break;
      default:
        body = this.buildFeedView();
    }

    replaceChildren(this.content, toolbar, body);
    this.updateCount();
  }

  // ---------------------------------------------------------------------------
  // Toolbar (tab switcher + actions)
  // ---------------------------------------------------------------------------
  private buildToolbar(): HTMLElement {
    const tabs: Array<{ key: SocialPanelView; label: string }> = [
      { key: 'feed', label: 'Feed' },
      { key: 'sources', label: 'Sources' },
      { key: 'assets', label: 'Assets' },
    ];

    const tabButtons = tabs.map((t) => {
      const btn = h('button', {
        className: `social-tab-btn ${this.currentView === t.key ? 'active' : ''}`,
      }, t.label);
      btn.addEventListener('click', () => {
        this.currentView = t.key;
        savePanelState({ view: t.key });
        this.render();
      });
      return btn;
    });

    const refreshBtn = h('button', {
      className: 'social-action-btn',
      title: 'Load mock messages',
    }, '\u21BB');
    refreshBtn.addEventListener('click', () => {
      const mockMsgs = generateMockMessages(5);
      addMessages(mockMsgs);
      this.render();
    });

    const clearBtn = h('button', {
      className: 'social-action-btn',
      title: 'Clear all messages',
    }, '\u2715');
    clearBtn.addEventListener('click', () => {
      clearMessages();
      this.render();
    });

    return h('div', { className: 'social-toolbar' },
      h('div', { className: 'social-tabs' }, ...tabButtons),
      h('div', { className: 'social-actions' }, refreshBtn, clearBtn),
    );
  }

  // ---------------------------------------------------------------------------
  // Feed view
  // ---------------------------------------------------------------------------
  private buildFeedView(): HTMLElement {
    const messages = getFilteredMessages();
    const assets = getAssets();

    if (messages.length === 0) {
      return h('div', { className: 'social-empty' },
        h('p', {}, 'No messages yet.'),
        h('p', { className: 'social-hint' }, 'Click \u21BB to load mock data, or add sources and connect a collector.'),
      );
    }

    const cards = messages.slice(0, 50).map((msg) => this.buildMessageCard(msg, assets));
    return h('div', { className: 'social-feed' }, ...cards);
  }

  private buildMessageCard(msg: SocialMessage, assets: SocialAsset[]): HTMLElement {
    const matchedAssets = assets.filter((a) => msg.matchedAssetIds.includes(a.id));
    const badges = matchedAssets.map((a) =>
      h('span', {
        className: 'social-asset-badge',
        style: `background:${a.color}20;color:${a.color};border:1px solid ${a.color}40`,
      }, a.name),
    );

    const timeStr = this.formatTime(msg.postedAt);

    const header = h('div', { className: 'social-msg-header' },
      h('span', { className: 'social-msg-channel' }, msg.channelName),
      h('span', { className: 'social-msg-time' }, timeStr),
    );

    const body = h('div', { className: 'social-msg-body' }, msg.text);

    const footer = badges.length > 0
      ? h('div', { className: 'social-msg-footer' }, ...badges)
      : h('div', { className: 'social-msg-footer' });

    const card = h('div', { className: 'social-msg-card' }, header, body, footer);

    if (msg.url) {
      card.addEventListener('click', () => {
        window.open(msg.url, '_blank', 'noopener');
      });
      card.style.cursor = 'pointer';
    }

    return card;
  }

  // ---------------------------------------------------------------------------
  // Sources view
  // ---------------------------------------------------------------------------
  private buildSourcesView(): HTMLElement {
    const sources = getSources();

    const addForm = this.buildAddSourceForm();

    const sourceCards = sources.map((s) => this.buildSourceCard(s));

    return h('div', { className: 'social-sources-view' },
      addForm,
      h('div', { className: 'social-source-list' }, ...sourceCards),
    );
  }

  private buildAddSourceForm(): HTMLElement {
    const channelInput = h('input', {
      type: 'text',
      placeholder: '@channel or t.me/channel',
      className: 'social-input',
    }) as HTMLInputElement;

    const nameInput = h('input', {
      type: 'text',
      placeholder: 'Display name',
      className: 'social-input',
    }) as HTMLInputElement;

    const addBtn = h('button', {
      className: 'social-add-btn',
    }, '+ Add Source');

    addBtn.addEventListener('click', () => {
      const channelId = channelInput.value.trim();
      const displayName = nameInput.value.trim();
      if (!channelId || !displayName) return;
      createSource(channelId, displayName);
      channelInput.value = '';
      nameInput.value = '';
      this.render();
    });

    return h('div', { className: 'social-add-form' },
      h('div', { className: 'social-form-row' }, channelInput, nameInput, addBtn),
    );
  }

  private buildSourceCard(source: SocialSource): HTMLElement {
    const statusDot = h('span', {
      className: `social-status-dot ${source.status}`,
    });

    const deleteBtn = h('button', {
      className: 'social-delete-btn',
      title: 'Remove source',
    }, '\u2715');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSource(source.id);
      this.render();
    });

    return h('div', { className: 'social-source-card' },
      h('div', { className: 'social-source-info' },
        statusDot,
        h('span', { className: 'social-source-name' }, source.displayName),
        h('span', { className: 'social-source-channel' }, source.channelId),
      ),
      deleteBtn,
    );
  }

  // ---------------------------------------------------------------------------
  // Assets view
  // ---------------------------------------------------------------------------
  private buildAssetsView(): HTMLElement {
    const assets = getAssets();

    const addForm = this.buildAddAssetForm();

    const assetCards = assets.map((a) => this.buildAssetCard(a));

    return h('div', { className: 'social-assets-view' },
      addForm,
      h('div', { className: 'social-asset-list' }, ...assetCards),
    );
  }

  private buildAddAssetForm(): HTMLElement {
    const nameInput = h('input', {
      type: 'text',
      placeholder: 'Asset name (e.g. Ukraine Conflict)',
      className: 'social-input',
    }) as HTMLInputElement;

    const keywordsInput = h('input', {
      type: 'text',
      placeholder: 'Keywords (comma separated)',
      className: 'social-input',
    }) as HTMLInputElement;

    const colorInput = h('input', {
      type: 'color',
      value: '#3b82f6',
      className: 'social-color-input',
    }) as HTMLInputElement;

    const addBtn = h('button', {
      className: 'social-add-btn',
    }, '+ Add Asset');

    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const rawKw = keywordsInput.value.trim();
      if (!name || !rawKw) return;
      const keywords = rawKw.split(',').map((k) => ({
        value: k.trim(),
        exclude: k.trim().startsWith('!'),
      })).map((k) => ({
        value: k.exclude ? k.value.slice(1) : k.value,
        exclude: k.exclude,
      })).filter((k) => k.value.length > 0);

      createAsset(name, colorInput.value, keywords);
      nameInput.value = '';
      keywordsInput.value = '';
      this.render();
    });

    return h('div', { className: 'social-add-form' },
      h('div', { className: 'social-form-row' }, nameInput, keywordsInput, colorInput, addBtn),
    );
  }

  private buildAssetCard(asset: SocialAsset): HTMLElement {
    const keywordChips = asset.keywords.map((k) =>
      h('span', {
        className: `social-keyword-chip ${k.exclude ? 'exclude' : ''}`,
      }, `${k.exclude ? 'NOT ' : ''}${k.value}`),
    );

    const deleteBtn = h('button', {
      className: 'social-delete-btn',
      title: 'Remove asset',
    }, '\u2715');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAsset(asset.id);
      this.render();
    });

    const colorDot = h('span', {
      className: 'social-color-dot',
      style: `background:${asset.color}`,
    });

    return h('div', { className: 'social-asset-card' },
      h('div', { className: 'social-asset-header' },
        colorDot,
        h('span', { className: 'social-asset-name' }, asset.name),
        h('span', { className: 'social-asset-mode' }, `(${asset.matchMode.toUpperCase()})`),
        deleteBtn,
      ),
      h('div', { className: 'social-keyword-list' }, ...keywordChips),
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private updateCount(): void {
    const messages = getFilteredMessages();
    this.setCount(messages.length);
  }

  private formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
  }

  public override destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    super.destroy();
  }
}
