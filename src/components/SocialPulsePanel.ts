import { Panel } from "./Panel";
import { h, replaceChildren } from "../utils/dom-utils";
import { getAssets } from "@/services/social";
import { computePulseTimeseries, loadPulseState, savePulseState, getSignals } from "@/services/social-pulse";
import type { PulseTimeframe, PulseBucket, PulseBucketData, PulseTimeseriesResponse, SocialSignal } from "@/types/social-pulse";
import type { SocialAsset } from "@/types/social";

export class SocialPulsePanel extends Panel {
  private state = loadPulseState();
  private data: PulseTimeseriesResponse | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor() {
    super({ id: "social-pulse", title: "Social Pulse", showCount: false, className: "social-pulse-panel" });
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), 60000);
  }

  public refresh(): void {
    if (this.state.selectedAssetId) {
      this.data = computePulseTimeseries(this.state.selectedAssetId, this.state.timeframe, this.state.bucket);
    } else { this.data = null; }
    this.state.lastUpdate = new Date().toISOString();
    savePulseState(this.state);
    this.render();
  }

  private render(): void {
    const assets = getAssets();
    const toolbar = this.buildToolbar(assets);
    let body: HTMLElement;
    if (assets.length === 0) {
      body = h("div", { className: "sp-empty" }, h("p", {}, "No assets configured."), h("p", { className: "sp-hint" }, "Add assets in the Social Monitor panel to begin tracking sentiment."));
      body = h("div", { className: "sp-empty" }, h("p", {}, "Select an asset above to view its Social Pulse wave."));
      const refreshBtn = h("button", { className: "sp-refresh-btn" }, "Refresh Social");
      refreshBtn.addEventListener("click", () => this.refresh());
      body = h("div", { className: "sp-empty" }, h("p", {}, "No data yet for this asset."), refreshBtn);
    } else {
      body = h("div", { className: "sp-body" }, this.buildWaveform(this.data), this.buildSummary(this.data), this.buildSignals());
    }
    replaceChildren(this.content, toolbar, body);
  }

  private buildToolbar(assets: SocialAsset[]): HTMLElement {
    const sel = h("select", { className: "sp-select" }) as HTMLSelectElement;
    const defOpt = h("option", { value: "" }, "-- Select Asset --") as HTMLOptionElement;
    sel.appendChild(defOpt);
    assets.forEach(a => {
      const opt = h("option", { value: a.id }, a.name) as HTMLOptionElement;
      if (a.id === this.state.selectedAssetId) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => { this.state.selectedAssetId = sel.value || null; this.refresh(); });

    const tfBtns = (["1h","6h","24h","7d"] as PulseTimeframe[]).map(tf => {
      const b = h("button", { className: "sp-tf-btn" + (this.state.timeframe === tf ? " active" : "") }, tf);
      b.addEventListener("click", () => { this.state.timeframe = tf; this.refresh(); });
      return b;
    });

    const bkBtns = (["5m","15m","60m"] as PulseBucket[]).map(bk => {
      const b = h("button", { className: "sp-bk-btn" + (this.state.bucket === bk ? " active" : "") }, bk);
      b.addEventListener("click", () => { this.state.bucket = bk; this.refresh(); });
      return b;
    });

    const lastUpd = h("span", { className: "sp-last-update" }, this.state.lastUpdate ? new Date(this.state.lastUpdate).toLocaleTimeString() : "--");

    return h("div", { className: "sp-toolbar" },
      h("div", { className: "sp-toolbar-row" }, sel, h("div", { className: "sp-tf-group" }, ...tfBtns)),
      h("div", { className: "sp-toolbar-row" }, h("div", { className: "sp-bk-group" }, ...bkBtns), lastUpd)
    );
  }

  private buildWaveform(data: PulseTimeseriesResponse): HTMLElement {
    const W = 600, H = 200, PAD = 30;
    const buckets = data.buckets;
    const n = buckets.length;
    if (n === 0) return h("div", {}, "No data");
    const xStep = (W - PAD * 2) / Math.max(n - 1, 1);
    const yScale = (H - PAD * 2) / 2;
    const midY = H / 2;

    let pathD = "";
    let areaD = "";
    const points: string[] = [];
    buckets.forEach((b, i) => {
      const x = PAD + i * xStep;
      const y = midY - b.pulseValue * yScale;
      if (i === 0) { pathD += "M" + x.toFixed(1) + "," + y.toFixed(1); areaD += "M" + PAD.toFixed(1) + "," + midY.toFixed(1) + "L" + x.toFixed(1) + "," + y.toFixed(1); }
      else { pathD += "L" + x.toFixed(1) + "," + y.toFixed(1); areaD += "L" + x.toFixed(1) + "," + y.toFixed(1); }
      points.push(x.toFixed(1) + "," + y.toFixed(1));
    });
    areaD += "L" + (PAD + (n-1)*xStep).toFixed(1) + "," + midY.toFixed(1) + "Z";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "sp-wave-svg");
    svg.innerHTML = "" +
      '<line x1="' + PAD + '" y1="' + midY + '" x2="' + (W-PAD) + '" y2="' + midY + '" class="sp-zero-line"/>' +
      '<path d="' + areaD + '" class="sp-wave-area"/>' +
      '<path d="' + pathD + '" class="sp-wave-line"/>' +
      '<text x="' + (PAD-5) + '" y="' + (PAD+5) + '" class="sp-axis-label">+1</text>' +
      '<text x="' + (PAD-5) + '" y="' + (H-PAD+15) + '" class="sp-axis-label">-1</text>' +
      '<text x="' + (PAD-5) + '" y="' + (midY+4) + '" class="sp-axis-label">0</text>';

    const wrapper = h("div", { className: "sp-wave-container" });
    wrapper.appendChild(svg);
    return wrapper;
  }

  private buildSummary(data: PulseTimeseriesResponse): HTMLElement {
    const s = data.summary;
    return h("div", { className: "sp-summary" },
      h("div", { className: "sp-stat" }, h("span", { className: "sp-stat-val" }, String(s.totalVolume)), h("span", { className: "sp-stat-label" }, "Messages")),
      h("div", { className: "sp-stat" }, h("span", { className: "sp-stat-val" }, s.maxZScore.toFixed(1)), h("span", { className: "sp-stat-label" }, "Z-Score")),
      h("div", { className: "sp-stat" }, h("span", { className: "sp-stat-val" }, s.negShareAvg.toFixed(0) + "%"), h("span", { className: "sp-stat-label" }, "Negative")),
      h("div", { className: "sp-stat" }, h("span", { className: "sp-stat-val sp-emotion" }, s.dominantEmotion), h("span", { className: "sp-stat-label" }, "Emotion"))
    );
  }

  private buildSignals(): HTMLElement {
    if (sigs.length === 0) return h("div", {});
    const items = sigs.map(s => {
      const cls = "sp-signal sp-signal-" + s.severity;
      return h("div", { className: cls }, h("span", { className: "sp-signal-icon" }, "⚡"), h("span", { className: "sp-signal-msg" }, s.message));
    });
    return h("div", { className: "sp-signals" }, ...items);
  }

  public override destroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    super.destroy();
  }
}
