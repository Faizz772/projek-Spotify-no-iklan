#!/usr/bin/env python3
"""Extract the standalone iOS bundle from a saved JustPaste page.

JustPaste renders source code as one escaped line per ``div > span`` and its
formatter removes a small, repeatable set of CSS property names. This importer
reverses only those display-layer transformations and keeps the bundled app,
runtime, resources, SVGs, state, and interaction logic intact.

Usage:
    python3 tools/import_ios_reference.py justpaste.html \
        apps/web/public/tactile-player.html
"""

from __future__ import annotations

import html
import json
from pathlib import Path
import re
import sys


ARTICLE_PATTERN = re.compile(
    r'<div id="articleContent">(.*?)\n\s*</div>\n\s*'
    r'<div id="showArticleBottomWidget">',
    re.DOTALL,
)
LINE_PATTERN = re.compile(r"<div><span>(.*?)</span></div>", re.DOTALL)
TEMPLATE_PATTERN = re.compile(
    r'(<script type="__bundler/template">\s*)(".*")(\s*</script>)',
    re.DOTALL,
)

API_METHODS = r'''
  apiBase = (() => {
    const value = new URLSearchParams(window.location.search).get("api") || "/api";
    return value.replace(/\/$/, "");
  })();
  audio = null;
  searchResults = [];
  favorites = new Set();
  getApiUrl(path) {
    if (/^https?:\/\//.test(path)) return path;
    return this.apiBase + path;
  }
  async apiRequest(path, init) {
    const response = await fetch(this.getApiUrl(path), init);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body && body.message ? body.message : "请求失败 (" + response.status + ")");
    }
    return response.json();
  }
  readStoredArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }
  cleanTitle(title, artist) {
    let value = String(title || "").replace(
      /\s*[\(\[].*?(official|lyrics|audio|video).*?[\)\]]/gi,
      ""
    ).trim();
    const prefix = String(artist || "") + " - ";
    if (value.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
      value = value.slice(prefix.length);
    }
    return value.length > 34 ? value.slice(0, 33) + "…" : value;
  }
  toLibraryTrack(track) {
    const art = track.artwork || {};
    return {
      id: track.id,
      t: this.cleanTitle(track.title, track.artist),
      a: track.artist,
      album: track.album || "YouTube Music",
      d: Number(track.durationSeconds) || 0,
      hue: art.background || "#b5581f",
      light: art.accent || "#e8933c",
      streamUrl: track.streamUrl
    };
  }
  toSearchTrack(track) {
    return {
      sourceId: track.sourceId,
      provider: track.provider,
      thumbnailUrl: track.thumbnailUrl,
      t: track.title,
      a: track.artist,
      album: "YouTube Music",
      d: Number(track.durationSeconds) || 0,
      hue: "#b5581f",
      light: "#e8933c",
      isSearchResult: true
    };
  }
  restoreCollections() {
    const stored = this.readStoredArray("miusix:playlists");
    const colors = [["#2f5d8a", "#1e3a58"], ["#4c6b44", "#2e4429"], ["#5c4a7a", "#382a51"]];
    const saved = stored.map((playlist, index) => {
      const songs = (playlist.trackIds || [])
        .map(id => this.lib.findIndex(track => track.id === id))
        .filter(i => i >= 0);
      const color = colors[index % colors.length];
      return { name: playlist.title, c1: color[0], c2: color[1], songs };
    });
    const favorites = this.lib
      .map((track, index) => this.favorites.has(track.id) ? index : -1)
      .filter(index => index >= 0);
    this.pls = [
      { name: "我的收藏", c1: "#b5581f", c2: "#7a3a1a", songs: favorites },
      ...(saved.length ? saved : [{
        name: "服务器曲库",
        c1: "#2f5d8a",
        c2: "#1e3a58",
        songs: this.lib.map((_, index) => index)
      }])
    ];
  }
  async loadTracks() {
    try {
      const tracks = await this.apiRequest("/v1/tracks");
      if (Array.isArray(tracks) && tracks.length) {
        this.lib = tracks.map(track => this.toLibraryTrack(track));
        this.restoreCollections();
        this.setState({
          idx: 0,
          sec: 0,
          playing: false,
          apiStatus: "已连接 · " + tracks.length + " 首",
          resultVersion: Date.now()
        });
      }
    } catch (error) {
      this.setState({
        playing: false,
        apiStatus: "无法连接音乐服务器",
        resultVersion: Date.now()
      });
    }
  }
  scheduleSearch(value) {
    clearTimeout(this._search);
    this.searchResults = [];
    const query = value.trim();
    this.setState({
      q: value,
      searching: query.length >= 2,
      apiStatus: query.length >= 2 ? "正在搜索…" : "",
      resultVersion: Date.now()
    });
    if (query.length < 2) return;
    this._search = setTimeout(() => this.runSearch(query), 320);
  }
  async runSearch(query) {
    try {
      const results = await this.apiRequest("/v1/search?q=" + encodeURIComponent(query));
      if (this.state.q.trim() !== query) return;
      this.searchResults = Array.isArray(results)
        ? results.map(track => this.toSearchTrack(track))
        : [];
      this.setState({
        searching: false,
        apiStatus: this.searchResults.length + " 个 YouTube Music 结果",
        resultVersion: Date.now()
      });
    } catch (error) {
      if (this.state.q.trim() !== query) return;
      this.searchResults = [];
      this.setState({
        searching: false,
        apiStatus: error instanceof Error ? error.message : "搜索失败",
        resultVersion: Date.now()
      });
    }
  }
  async importAndPlay(result) {
    this.setState({ searching: true, apiStatus: "正在缓存并准备播放…" });
    try {
      const track = await this.apiRequest("/v1/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: result.provider,
          sourceId: result.sourceId,
          title: result.t,
          artist: result.a,
          durationSeconds: result.d,
          thumbnailUrl: result.thumbnailUrl
        })
      });
      const mapped = this.toLibraryTrack(track);
      let index = this.lib.findIndex(item => item.id === mapped.id);
      if (index >= 0) this.lib[index] = mapped;
      else {
        this.lib.push(mapped);
        index = this.lib.length - 1;
      }
      this.searchResults = [];
      this.restoreCollections();
      this.setState({
        q: "",
        searching: false,
        apiStatus: "已缓存 · 正在播放",
        resultVersion: Date.now()
      });
      this.change(index, { page: "play" });
    } catch (error) {
      this.setState({
        searching: false,
        apiStatus: error instanceof Error ? error.message : "无法缓存音频",
        resultVersion: Date.now()
      });
    }
  }
  startAudio(index) {
    const track = this.lib[index];
    if (!track || !track.streamUrl || !this.audio) {
      this.setState({ playing: true });
      return;
    }
    const source = this.getApiUrl(track.streamUrl);
    if (this.audio.src !== new URL(source, window.location.href).href) {
      this.audio.src = source;
      this.audio.currentTime = 0;
    }
    this.audio.volume = this.state.vol;
    this.audio.play()
      .then(() => this.setState({ playing: true, apiStatus: "" }))
      .catch(() => this.setState({
        playing: false,
        apiStatus: "音频尚未缓存或播放被浏览器阻止"
      }));
  }
  togglePlayback() {
    const track = this.lib[this.state.idx];
    if (!track || !track.streamUrl || !this.audio) {
      this.setState(state => ({ playing: !state.playing }));
      return;
    }
    if (this.audio.paused) this.startAudio(this.state.idx);
    else {
      this.audio.pause();
      this.setState({ playing: false });
    }
  }
  toggleLike() {
    const track = this.lib[this.state.idx];
    if (!track || !track.id) return;
    if (this.favorites.has(track.id)) this.favorites.delete(track.id);
    else this.favorites.add(track.id);
    localStorage.setItem("miusix:favorites", JSON.stringify([...this.favorites]));
    this.restoreCollections();
    this.setState({
      liked: this.favorites.has(track.id),
      resultVersion: Date.now()
    });
  }
  seekAudio(event) {
    const track = this.lib[this.state.idx];
    const seconds = Math.round(this.barPct(event) * track.d);
    if (this.audio && this.audio.src) this.audio.currentTime = seconds;
    this.setState({ sec: seconds });
  }
  setAudioVolume(event) {
    const volume = this.barPct(event);
    if (this.audio) this.audio.volume = volume;
    this.setState({ vol: volume });
  }
'''


def replace_required(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise ValueError(f"Expected one {label} marker, found {count}")
    return text.replace(before, after, 1)


def connect_api(template: str) -> str:
    template = replace_required(
        template,
        '  state = { playing: true, idx: 0, sec: 95, vol: 0.7, liked: false, '
        'page: "play", q: "", plIdx: 0, cfg: {} };',
        '  state = { playing: false, idx: 0, sec: 0, vol: 0.7, liked: false, '
        'page: "play", q: "", plIdx: 0, cfg: {}, searching: false, '
        'apiStatus: "正在连接服务器", resultVersion: 0 };',
        "initial state",
    )
    template = replace_required(
        template,
        "  componentDidMount() {",
        API_METHODS + "\n  componentDidMount() {",
        "component lifecycle",
    )
    template = replace_required(
        template,
        '''  componentDidMount() {
    this.timer = setInterval(() => {
      const s = this.state;
      if (!s.playing || s.swap) return;
      if (s.sec + 1 >= this.lib[s.idx].d) this.change((s.idx + 1) % this.lib.length);
      else this.setState({ sec: s.sec + 1 });
    }, 1000);
  }
  componentWillUnmount() { clearInterval(this.timer); clearTimeout(this._sw1); clearTimeout(this._sw2); }
  change(i, extra, dir) {
    if (this.state.swap) return;
    if (i === this.state.idx) { this.setState(Object.assign({ playing: true }, extra)); return; }
    this.setState(Object.assign({ swap: "out", swapDir: dir || "fwd" }, extra));
    this._sw1 = setTimeout(() => this.setState({ idx: i, sec: 0, swap: "in" }), 470);
    this._sw2 = setTimeout(() => this.setState({ swap: null, playing: true }), 1000);
  }''',
        '''  componentDidMount() {
    if (new URLSearchParams(window.location.search).get("embedded") === "1") {
      document.body.style.padding = "14px 0";
    }
    this.favorites = new Set(this.readStoredArray("miusix:favorites"));
    this._onStorage = event => {
      if (event.key === "miusix:favorites") {
        this.favorites = new Set(this.readStoredArray("miusix:favorites"));
      }
      if (event.key === "miusix:favorites" || event.key === "miusix:playlists") {
        this.restoreCollections();
        this.setState({ resultVersion: Date.now() });
      }
    };
    window.addEventListener("storage", this._onStorage);
    this.audio = new Audio();
    this.audio.preload = "none";
    this.audio.addEventListener("timeupdate", () => {
      this.setState({ sec: Math.floor(this.audio.currentTime) });
    });
    this.audio.addEventListener("ended", () => {
      this.change((this.state.idx + 1) % this.lib.length);
    });
    this.audio.addEventListener("error", () => {
      this.setState({ playing: false, apiStatus: "音频文件不可用" });
    });
    this.restoreCollections();
    void this.loadTracks();
    this.timer = setInterval(() => {
      const state = this.state;
      const track = this.lib[state.idx];
      if (track && track.streamUrl) return;
      if (!state.playing || state.swap) return;
      if (state.sec + 1 >= track.d) this.change((state.idx + 1) % this.lib.length);
      else this.setState({ sec: state.sec + 1 });
    }, 1000);
  }
  componentWillUnmount() {
    clearInterval(this.timer);
    clearTimeout(this._search);
    clearTimeout(this._sw1);
    clearTimeout(this._sw2);
    window.removeEventListener("storage", this._onStorage);
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
    }
  }
  change(i, extra, dir) {
    if (this.state.swap || !Number.isInteger(i) || !this.lib[i]) return;
    if (i === this.state.idx) {
      this.setState(Object.assign({}, extra));
      this.startAudio(i);
      return;
    }
    this.setState(Object.assign({ swap: "out", swapDir: dir || "fwd" }, extra));
    this._sw1 = setTimeout(() => {
      this.setState({ idx: i, sec: 0, swap: "in" });
      this.startAudio(i);
    }, 470);
    this._sw2 = setTimeout(() => this.setState({ swap: null }), 1000);
  }''',
        "playback lifecycle",
    )
    template = replace_required(
        template,
        '''      t: t.t, a: t.a, dur: fmt(t.d), hue: t.light,
      bg: active ? "linear-gradient(#4e4234,#3b3126)" : "linear-gradient(#332a20,#2b2318)",
      shadow: active ? "inset 0 1px 1px rgba(240,217,181,0.25), 0 3px 8px rgba(0,0,0,0.4)" : "inset 0 2px 4px rgba(0,0,0,0.45)",
      borderA: active ? "0.35" : "0.1",
      pick: () => this.change(i, { page: "play" })''',
        '''      t: t.t, a: t.a, album: t.album || "YouTube Music", dur: fmt(t.d), hue: t.light,
      bg: active ? "linear-gradient(#4e4234,#3b3126)" : "linear-gradient(#332a20,#2b2318)",
      shadow: active ? "inset 0 1px 1px rgba(240,217,181,0.25), 0 3px 8px rgba(0,0,0,0.4)" : "inset 0 2px 4px rgba(0,0,0,0.45)",
      borderA: active ? "0.35" : "0.1",
      pick: () => t.isSearchResult
        ? this.importAndPlay(t)
        : this.change(i, { page: "play" })''',
        "track row",
    )
    template = replace_required(
        template,
        '    const matches = query ? this.lib.map((t, i) => [t, i]).filter(([t]) => '
        '(t.t + t.a).includes(query)) : this.lib.map((t, i) => [t, i]);',
        '''    const matches = query
      ? (this.searchResults.length
        ? this.searchResults.map(track => [track, -1])
        : (this.state.searching
          ? []
          : this.lib.map((track, i) => [track, i]).filter(([track]) =>
              (track.t + track.a).toLocaleLowerCase().includes(query.toLocaleLowerCase()))))
      : this.lib.map((track, i) => [track, i]);''',
        "search results",
    )
    template = replace_required(
        template,
        '''      heartFill: liked ? "#c0392b" : "rgba(0,0,0,0.08)",
      toggle: () => this.setState(s => ({ playing: !s.playing })),
      next: () => this.change((idx + 1) % this.lib.length),
      prev: () => { if (sec > 4) this.setState({ sec: 0 }); else this.change((idx + this.lib.length - 1) % this.lib.length, null, "back"); },
      like: () => this.setState(s => ({ liked: !s.liked })),
      seek: e => { const p = this.barPct(e); this.setState({ sec: Math.round(p * tr.d) }); },
      setVol: e => this.setState({ vol: this.barPct(e) }),''',
        '''      heartFill: tr.id && this.favorites.has(tr.id) ? "#c0392b" : "rgba(0,0,0,0.08)",
      toggle: () => this.togglePlayback(),
      next: () => this.change((idx + 1) % this.lib.length),
      prev: () => {
        if (sec > 4) {
          if (this.audio && this.audio.src) this.audio.currentTime = 0;
          this.setState({ sec: 0 });
        } else this.change((idx + this.lib.length - 1) % this.lib.length, null, "back");
      },
      like: () => this.toggleLike(),
      seek: e => this.seekAudio(e),
      setVol: e => this.setAudioVolume(e),''',
        "player controls",
    )
    template = replace_required(
        template,
        '''      q, hasQ: query.length > 0,
      onQ: e => this.setState({ q: e.target.value }),
      clearQ: () => this.setState({ q: "" }),
      chips: ["白鹭", "陈屿", "南方", "雾"].map(w => ({ w, go: () => this.setState({ q: w }) })),
      resultsLabel: query ? "搜索结果" : "热门歌曲",
      results: matches.map(([t, i]) => this.row(t, i)),
      noResults: query.length > 0 && matches.length === 0,''',
        '''      q, hasQ: query.length > 0,
      onQ: e => this.scheduleSearch(e.target.value),
      clearQ: () => this.scheduleSearch(""),
      chips: ["Adele", "周杰伦", "Taylor Swift", "Coldplay"].map(w => ({
        w,
        go: () => this.scheduleSearch(w)
      })),
      resultsLabel: this.state.searching
        ? this.state.apiStatus
        : (query ? "搜索结果" : (this.state.apiStatus || "服务器曲库")),
      results: matches.map(([t, i]) => this.row(t, i)),
      noResults: query.length > 0 && !this.state.searching && matches.length === 0,
      emptyMessage: this.state.apiStatus || "没有找到相关歌曲，换个关键词试试",
      favoriteCount: this.favorites.size,
      playlistCount: this.pls.length,
      libraryCount: this.lib.length,''',
        "search controls",
    )
    template = replace_required(
        template,
        '      playAll: () => this.change(pl.songs[0], { page: "play" })',
        '      playAll: () => pl.songs.length && this.change(pl.songs[0], { page: "play" })',
        "playlist playback",
    )
    template = replace_required(
        template,
        '      title: tr.t, artist: tr.a, trackNo: idx + 1,',
        '      title: tr.t, artist: tr.a, trackNo: idx + 1,\n'
        '      playStateLabel: playing ? "正在播放" : "已暂停",',
        "playback state",
    )
    template = replace_required(
        template,
        '>正在播放</span>',
        '>{{ playStateLabel }}</span>',
        "playback state label",
    )
    template = replace_required(
        template,
        '{{ trackNo }} / 8',
        '{{ trackNo }} / {{ libraryCount }}',
        "track count",
    )
    template = replace_required(
        template,
        '{{ row.a }} · 《南方以南》',
        '{{ row.a }} · {{ row.album }}',
        "search result album",
    )
    template = replace_required(
        template,
        '没有找到相关歌曲<br>换个关键词试试',
        '{{ emptyMessage }}',
        "empty search message",
    )
    template = replace_required(
        template,
        '<div style="font:400 28px/1 VT323,monospace;text-shadow:{{ lcdGlow }}">128</div>',
        '<div style="font:400 28px/1 VT323,monospace;text-shadow:{{ lcdGlow }}">{{ favoriteCount }}</div>',
        "favorite count",
    )
    template = replace_required(
        template,
        '<div style="font:400 28px/1 VT323,monospace;text-shadow:{{ lcdGlow }}">12</div>',
        '<div style="font:400 28px/1 VT323,monospace;text-shadow:{{ lcdGlow }}">{{ playlistCount }}</div>',
        "playlist count",
    )
    template = replace_required(
        template,
        '''<div style="text-align:center"><div style="font:400 28px/1 VT323,monospace;text-shadow:{{ lcdGlow }}">36</div><div style="font:600 11px/1.8 Figtree;color:{{ lcdSub }}">关注</div></div>''',
        '''<div style="text-align:center"><div style="font:400 28px/1 VT323,monospace;text-shadow:{{ lcdGlow }}">{{ libraryCount }}</div><div style="font:600 11px/1.8 Figtree;color:{{ lcdSub }}">曲目</div></div>''',
        "library count",
    )
    return template


def extract_source(page: str) -> str:
    article = ARTICLE_PATTERN.search(page)
    if article is None:
        raise ValueError("Could not find JustPaste articleContent")

    lines = [html.unescape(line) for line in LINE_PATTERN.findall(article.group(1))]
    # JustPaste uses non-breaking spaces for source indentation. They are
    # visually indistinguishable, but JSON.parse only accepts the JSON-defined
    # ASCII whitespace around manifest and template payloads.
    source = "\n".join(lines).replace("\N{NO-BREAK SPACE}", " ")
    if not source.lstrip().startswith("<!DOCTYPE html>"):
        raise ValueError("The article does not contain a standalone HTML document")
    return source


def repair_inline_styles(template: str) -> str:
    def repair(match: re.Match[str]) -> str:
        declarations = match.group(1).split(";")
        fixed: list[str] = []
        for declaration in declarations:
            value = declaration.strip()
            if value and ":" not in value:
                whitespace = declaration[: len(declaration) - len(declaration.lstrip())]
                property_name = (
                    "font-family"
                    if re.search(r"[A-Za-z]", value)
                    and not re.match(r"^-?(?:\d|\.)", value)
                    else "margin"
                )
                declaration = f"{whitespace}{property_name}: {declaration.lstrip()}"
            fixed.append(declaration)
        return f'style="{";".join(fixed)}"'

    return re.sub(r'style="([^"]*)"', repair, template)


def repair_source(source: str) -> str:
    template_match = TEMPLATE_PATTERN.search(source)
    if template_match is None:
        raise ValueError("Could not find the bundled template")

    template = json.loads(template_match.group(2))
    template = template.replace("u rl(", "url(")
    template = re.sub(
        r"(@font-face\s*\{\s*)(['\"](?:Figtree|VT323)['\"]\s*;)",
        r"\1font-family: \2",
        template,
    )
    template = template.replace("body{0;", "body{margin:0;")
    template = repair_inline_styles(template)
    template = connect_api(template)
    template = template.replace(
        "<html><head>\n<meta charset=\"utf-8\">",
        "<html><head>\n<meta charset=\"utf-8\">\n"
        "<title>Miusix · iOS tactile player</title>",
    )

    # Escaping the closing slash prevents the outer HTML parser from ending
    # the JSON script at a nested </script> inside the template.
    encoded_template = json.dumps(template, ensure_ascii=False).replace("</", r"<\/")
    source = (
        source[: template_match.start(2)]
        + encoded_template
        + source[template_match.end(2) :]
    )

    template_offset = source.find('<script type="__bundler/template">')
    outer, bundle = source[:template_offset], source[template_offset:]
    outer = re.sub(r"\* \{\s*0;", "* { margin: 0;", outer)
    outer = outer.replace(
        "min-height: 100vh;  -apple-system",
        "min-height: 100vh; font-family: -apple-system",
    )
    outer = outer.replace(
        "<title>Bundled Page</title>",
        "<title>Miusix · iOS tactile player</title>",
    )
    return outer + bundle


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: import_ios_reference.py INPUT OUTPUT")

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        repair_source(extract_source(input_path.read_text())),
        encoding="utf-8",
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
