(function () {
  "use strict";
  var KEY = "wn-word-coach-v4";
  var SESS = "wn-parent-student";

  var S = null;
  var me = null;
  var tab = "home";
  var sub = null;
  var subArg = null;
  var quiz = null;
  var rv = null;
  var rvResult = null;

  /* ---------------- 工具 ---------------- */
  var $ = function (s) { return document.querySelector(s); };
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(v) { return String(v === undefined || v === null ? "" : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function p2(n) { return String(n).length < 2 ? "0" + n : String(n); }
  function ymd(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function todayKey() { return ymd(new Date()); }
  function toast(msg) {
    var root = document.getElementById("toastRoot");
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () { t.remove(); }, 1900);
  }
  function empty(txt) { return '<div class="empty">' + esc(txt) + "</div>"; }
  /* 英式发音 */
  var voiceGB = null;
  function pickVoice() {
    try {
      var vs = window.speechSynthesis.getVoices() || [];
      voiceGB = vs.filter(function (v) { return /en[-_]GB/i.test(v.lang); })[0] ||
        vs.filter(function (v) { return /english \(united kingdom\)|kate|daniel|serena|arthur/i.test(v.name); })[0] || null;
    } catch (e) { voiceGB = null; }
  }
  function speak(text) {
    try {
      if (!window.speechSynthesis || !text) return;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
      if (voiceGB) u.voice = voiceGB;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  /* ---------------- 数据 ---------------- */
  function load() {
    try { var raw = localStorage.getItem(KEY); S = raw ? JSON.parse(raw) : null; } catch (e) { S = null; }
    if (!S || typeof S !== "object") S = {};
    if (!Array.isArray(S.students)) S.students = [];
    if (!Array.isArray(S.courses)) S.courses = [];
    if (!Array.isArray(S.records)) S.records = [];
    if (!Array.isArray(S.reviews)) S.reviews = [];
    if (!S.progress) S.progress = {};
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  var courseById = function (id) { return S.courses.filter(function (c) { return c.id === id; })[0] || null; };
  var courseWords = function (c) { return (c && c.words) || []; };
  var courseSize = function (c) { return courseWords(c).length; };
  function progOf(cid) { return S.progress[(me ? me.id : "") + "::" + cid] || {}; }
  function learnedSet(cid) {
    var c = courseById(cid), ids = {}, set = {};
    if (c) courseWords(c).forEach(function (w) { ids[w.w] = 1; });
    var p = progOf(cid);
    (p.learned || []).concat(p.known || []).forEach(function (w) { if (ids[w]) set[w] = 1; });
    return set;
  }
  function learnedCount(cid) { return Object.keys(learnedSet(cid)).length; }
  function learnedWords(cid) {
    var set = learnedSet(cid);
    return courseWords(courseById(cid)).filter(function (w) { return set[w.w]; });
  }
  function myRecords() {
    if (!me) return [];
    return S.records.filter(function (r) { return r.studentId === me.id || r.student === me.name; });
  }
  function myReviews() {
    if (!me) return [];
    return S.reviews.filter(function (r) { return r.studentId === me.id || r.student === me.name; });
  }
  function myCourses() {
    return (me && me.courses ? me.courses : []).map(courseById).filter(Boolean);
  }
  function allLearnedWords() {
    var seen = {}, out = [];
    myCourses().forEach(function (c) {
      learnedWords(c.id).forEach(function (w) {
        if (!seen[w.w]) { seen[w.w] = 1; out.push({ w: w.w, ph: w.ph, m: w.m, course: c.name }); }
      });
    });
    return out;
  }
  function stat() {
    var recs = myRecords();
    var mins = recs.reduce(function (a, r) { return a + (r.minutes || 0); }, 0);
    return {
      hours: (me && me.hours) || 0,
      words: allLearnedWords().length,
      lessons: recs.length,
      minutes: mins,
      hoursDone: Math.round((mins / 60) * 10) / 10,
    };
  }
  function favs() { return (me && Array.isArray(me.favs)) ? me.favs : []; }
  function isFav(w) { return favs().some(function (x) { return x.w === w; }); }
  function toggleFav(word) {
    if (!me) return;
    if (!Array.isArray(me.favs)) me.favs = [];
    var i = -1;
    me.favs.forEach(function (x, k) { if (x.w === word.w) i = k; });
    if (i >= 0) { me.favs.splice(i, 1); toast("已取消收藏"); }
    else { me.favs.push({ w: word.w, ph: word.ph, m: word.m }); toast("已加入收藏夹"); }
    save();
    render();
  }

  /* ---------------- 登录 ---------------- */
  function viewLogin() {
    return (
      '<div class="login">' +
      '<div class="brand">Diana\'s Pathway</div>' +
      '<div class="tip">家长端 · 请登录查看孩子的学习情况</div>' +
      '<div class="card">' +
      '<div class="fld"><label>学生姓名 / 手机号</label><input id="lgUser" placeholder="请输入学生姓名或手机号" autocomplete="username" /></div>' +
      '<div class="fld"><label>密码</label><input id="lgPass" type="password" placeholder="请输入密码" autocomplete="current-password" /></div>' +
      '<div class="err" id="lgErr"></div>' +
      '<button class="btn btn-primary btn-block" data-act="login">登录</button>' +
      "</div></div>"
    );
  }
  function doLogin() {
    var uEl = document.getElementById("lgUser");
    var pEl = document.getElementById("lgPass");
    var eEl = document.getElementById("lgErr");
    var u = uEl ? uEl.value.trim() : "";
    var p = pEl ? pEl.value : "";
    var hit = S.students.filter(function (s) { return s.name === u || (s.phone && s.phone === u); })[0];
    if (hit && (hit.pass || "123456") === p) {
      if (hit.status === "禁用") { if (eEl) eEl.textContent = "该账号已停用，请联系老师"; return; }
      try { localStorage.setItem(SESS, hit.id); } catch (e) { /* ignore */ }
      me = hit;
      tab = "home"; sub = null;
      render();
      toast("欢迎，" + hit.name);
    } else {
      if (eEl) eEl.textContent = "姓名或密码不正确";
      if (pEl) { pEl.value = ""; pEl.focus(); }
    }
  }
  function logout() {
    try { localStorage.removeItem(SESS); } catch (e) { /* ignore */ }
    me = null; sub = null; tab = "home";
    render();
  }

  /* ---------------- 顶部栏 ---------------- */
  function topbar(title, back) {
    return (
      '<div class="topbar">' +
      (back ? '<button class="back" data-act="back">‹</button>' : "") +
      "<h1>" + esc(title) + "</h1><div class=\"sp\"></div>" +
      "</div>"
    );
  }

  /* ---------------- 首页 ---------------- */
  function viewHome() {
    var st = stat();
    var pend = myReviews().filter(function (r) { return r.status !== "已完成" && r.date <= todayKey(); }).length;
    var meta = [me.grade, me.school].filter(Boolean).join(" · ") || "学员";
    function item(act, title, desc, icon, badge) {
      return (
        '<div class="row tap" data-act="' + act + '">' +
        '<span class="ic">' + icon + "</span>" +
        '<div class="m"><b>' + title + "</b><small>" + desc + "</small></div>" +
        (badge || "") + '<span class="arw">›</span></div>'
      );
    }
    var icProgress = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16"/><path d="M8 19v-6M13 19V8M18 19v-9"/></svg>';
    var icFav = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 4.6 2.3 4.7 5.2.7-3.8 3.6.9 5.1-4.6-2.5-4.6 2.5.9-5.1L4.5 10l5.2-.7L12 4.6Z"/></svg>';
    var icAnti = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4.5v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 19.5v-4h4"/></svg>';
    var icQuiz = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6.5 6.5 0 0 1 3.9 11.7c-.6.5-.9 1.1-.9 1.8v.5h-6v-.5c0-.7-.3-1.3-.9-1.8A6.5 6.5 0 0 1 12 3Z"/><path d="M9.5 20.5h5"/></svg>';
    return (
      topbar("首页") +
      '<div class="page">' +
      '<div class="card stu">' +
      '<span class="av">' + esc((me.name || "学").slice(0, 1)) + "</span>" +
      '<div><div class="nm">' + esc(me.name) + '</div><div class="mt">' + esc(meta) + "</div></div>" +
      '<div class="hrs"><b>' + st.hours + "</b><small>剩余课时</small></div>" +
      "</div>" +
      '<div class="sec-title">我的学习</div>' +
      '<div class="card">' +
      item("go-progress", "学习进度", "已开通 " + myCourses().length + " 个词库 · 已识 " + st.words + " 词", icProgress) +
      item("go-favs", "收藏夹", favs().length ? "已收藏 " + favs().length + " 个单词" : "还没有收藏的单词", icFav) +
      item("go-anti", "抗遗忘", "共 " + myReviews().length + " 次复习计划", icAnti,
        pend ? '<span class="badge live">' + pend + " 待复习</span>" : "") +
      item("go-practice", "智能练习", st.words ? "用已学 " + st.words + " 个单词练习" : "先学一些单词再来练习", icQuiz) +
      "</div></div>"
    );
  }

  /* ---------------- 销课记录 ---------------- */
  function viewRecord() {
    var recs = myRecords().slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var rows = recs.length ? recs.map(function (r) {
      var n = (r.words || []).length;
      var rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
      return (
        '<div class="row" data-act="open-record" data-id="' + esc(r.id) + '">' +
        '<div class="m"><b>' + esc(r.course || r.subject) + "</b>" +
        "<small>" + esc(r.date) + " · " + esc(r.type) + " · " + n + " 个单词 · 正确率 " + rate + "%</small></div>" +
        '<span class="r">›</span></div>'
      );
    }).join("") : empty("还没有上课记录");
    return topbar("销课记录") + '<div class="page"><div class="card">' + rows + "</div></div>";
  }
  function viewRecordDetail() {
    var r = myRecords().filter(function (x) { return x.id === subArg; })[0];
    if (!r) return topbar("上课详情", true) + '<div class="page">' + empty("记录不存在") + "</div>";
    var ws = r.words || [];
    var rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
    var rows = ws.length ? ws.map(function (w) {
      return '<div class="word"><span class="en">' + esc(w.w) + '</span><span class="ph">' + esc(w.ph) + '</span><span class="cn">' + esc(w.m) + "</span></div>";
    }).join("") : empty("这节课没有单词记录");
    return (
      topbar("上课详情", true) +
      '<div class="page">' +
      '<div class="card"><div class="m"><b>' + esc(r.course || r.subject) + "</b><small>" + esc(r.date) + " · " + esc(r.type) +
      " · 正确率 " + rate + "% · " + (r.minutes || 0) + " 分钟</small></div></div>" +
      '<div class="sec-title">本节课学的单词（' + ws.length + "）</div>" +
      '<div class="card">' + rows + "</div></div>"
    );
  }

  /* ---------------- 个人中心 ---------------- */
  function viewMe() {
    var st = stat();
    function kv(k, v) { return '<div class="row"><div class="m"><b>' + esc(k) + '</b></div><div class="r" style="color:var(--text);font-weight:600">' + esc(v || "—") + "</div></div>"; }
    return (
      topbar("个人中心") +
      '<div class="page">' +
      '<div class="card stu"><span class="av">' + esc((me.name || "学").slice(0, 1)) + "</span>" +
      '<div><div class="nm">' + esc(me.name) + '</div><div class="mt">' + esc([me.grade, me.school].filter(Boolean).join(" · ") || "学员") + "</div></div></div>" +
      '<div class="sec-title">学习数据</div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + st.hours + "</b><small>剩余课时</small></div>" +
      '<div class="stat"><b>' + st.words + "</b><small>累计识词</small></div>" +
      '<div class="stat"><b>' + st.hoursDone + "</b><small>累积学时</small></div>" +
      "</div>" +
      '<div class="sec-title">基本信息</div>' +
      '<div class="card">' +
      kv("姓名", me.name) + kv("手机号", me.phone) + kv("年级", me.grade) + kv("学校", me.school) +
      kv("加入时间", me.joinedAt) + kv("账号状态", me.status === "禁用" ? "已停用" : "正常") +
      "</div>" +
      '<div style="margin-top:14px"><button class="btn btn-danger btn-block" data-act="logout">退出登录</button></div>' +
      "</div>"
    );
  }

  /* ---------------- 学习进度 ---------------- */
  function viewProgress() {
    var cs = myCourses();
    var rows = cs.length ? cs.map(function (c) {
      var done = learnedCount(c.id), total = courseSize(c);
      var pct = total ? Math.round((done / total) * 100) : 0;
      return (
        '<div class="row" data-act="open-course" data-id="' + esc(c.id) + '" style="display:block">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
        '<div class="m"><b>' + esc(c.name) + "</b><small>已学 " + done + " / " + total + " 词 · " + pct + "%</small></div>" +
        '<span class="r">›</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div></div>'
      );
    }).join("") : empty("还没有开通词库");
    return topbar("学习进度", true) + '<div class="page"><div class="card">' + rows + "</div></div>";
  }
  function viewCourse() {
    var c = courseById(subArg);
    if (!c) return topbar("词库", true) + '<div class="page">' + empty("词库不存在") + "</div>";
    var ws = learnedWords(c.id);
    var rows = ws.length ? ws.map(wordRow).join("") : empty("还没有学过的单词");
    return (
      topbar(c.name, true) +
      '<div class="page"><div class="sec-title" style="margin-top:4px">已学单词（' + ws.length + "）</div>" +
      '<div class="card">' + rows + "</div></div>"
    );
  }
  function wordRow(w) {
    var on = isFav(w.w);
    return (
      '<div class="word"><span class="en">' + esc(w.w) + '</span><span class="ph">' + esc(w.ph) + '</span><span class="cn">' + esc(w.m) + "</span>" +
      '<button class="star' + (on ? " on" : "") + '" data-act="fav" data-w="' + esc(w.w) + '" data-m="' + esc(w.m) + '" data-ph="' + esc(w.ph) + '">★</button></div>'
    );
  }

  /* ---------------- 收藏夹 ---------------- */
  function viewFavs() {
    var list = favs();
    var rows = list.length ? list.map(function (w) {
      return (
        '<div class="word"><span class="en">' + esc(w.w) + '</span><span class="ph">' + esc(w.ph) + '</span><span class="cn">' + esc(w.m) + "</span>" +
        '<button class="star on" data-act="fav" data-w="' + esc(w.w) + '" data-m="' + esc(w.m) + '" data-ph="' + esc(w.ph) + '">★</button></div>'
      );
    }).join("") : empty("还没有收藏的单词。去「学习进度」里点单词右边的 ☆ 收藏吧");
    return topbar("收藏夹", true) + '<div class="page"><div class="card">' + rows + "</div></div>";
  }

  /* ---------------- 抗遗忘 ---------------- */
  function mdLabel(d) { var a = new Date(d + "T00:00:00"); return (a.getMonth() + 1) + "月" + a.getDate() + "日"; }
  function dayLabel(d) {
    var t = todayKey();
    if (d === t) return "今天";
    var a = new Date(d + "T00:00:00"), b = new Date(t + "T00:00:00");
    var diff = Math.round((a.getTime() - b.getTime()) / 86400000);
    if (diff === 1) return "明天";
    if (diff === 2) return "后天";
    if (diff === -1) return "昨天";
    if (diff < 0) return "已过 " + (-diff) + " 天";
    return "周" + "日一二三四五六".charAt(a.getDay());
  }
  function viewAnti() {
    var list = myReviews().slice().sort(function (a, b) {
      return (a.date || "").localeCompare(b.date || "") || (a.round - b.round);
    });
    if (!list.length) return topbar("抗遗忘", true) + '<div class="page"><div class="card">' + empty("还没有抗遗忘复习计划") + "</div></div>";
    var groups = {};
    list.forEach(function (r) { (groups[r.date] = groups[r.date] || []).push(r); });
    var html = Object.keys(groups).sort().map(function (d) {
      var rows = groups[d].map(function (r) {
        var done = r.status === "已完成";
        var rec = S.records.filter(function (x) { return x.id === r.recordId; })[0];
        var wn = rec ? (rec.words || []).length : 0;
        var badge = done ? '<span class="badge ok">已完成</span>'
          : d < todayKey() ? '<span class="badge live">已过期</span>'
            : d === todayKey() ? '<span class="badge wait">今天</span>'
              : '<span class="badge gray">待到期</span>';
        var sub2 = wn + " 个单词" + (done ? " · ✅ " + (r.correct || 0) + " · ❌ " + Math.max(0, (r.total || 0) - (r.correct || 0)) : "");
        var right = done
          ? badge
          : '<button class="btn btn-primary mini" data-act="anti-start" data-id="' + esc(r.id) + '">开始复习</button>';
        return (
          '<div class="row"><div class="m"><b>' + esc(r.course || "复习") + " · 第 " + r.round + " 次</b>" +
          "<small>" + sub2 + "</small></div>" + right + "</div>"
        );
      }).join("");
      return '<div class="sec-title">' + mdLabel(d) + " · " + dayLabel(d) + "（" + groups[d].length + '）</div><div class="card">' + rows + "</div>";
    }).join("");
    return topbar("抗遗忘", true) + '<div class="page">' + html + "</div>";
  }
  function startAnti(id) {
    var r = myReviews().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var rec = S.records.filter(function (x) { return x.id === r.recordId; })[0];
    var words = rec ? (rec.words || []).map(function (w) { return { w: w.w, ph: w.ph, m: w.m }; }) : [];
    if (!words.length) { toast("这节课没有单词记录"); return; }
    rv = { id: r.id, round: r.round, course: r.course, words: words, marks: {} };
    sub = "antiDo";
    render();
  }
  function viewAntiDo() {
    if (!rv) return topbar("抗遗忘", true) + '<div class="page">' + empty("没有进行中的复习") + "</div>";
    var rows = rv.words.map(function (w) {
      var mk = rv.marks[w.w];
      var cls = mk === true ? " ok" : mk === false ? " bad" : "";
      return (
        '<div class="rv' + cls + '">' +
        '<span class="en" data-act="anti-say" data-w="' + esc(w.w) + '">' + esc(w.w) + "</span>" +
        '<span class="cn">' + (mk === undefined ? "" : esc(w.m)) + "</span>" +
        '<span class="ops">' +
        '<button class="' + (mk === true ? "on" : "") + '" data-act="anti-ok" data-w="' + esc(w.w) + '">✅</button>' +
        '<button class="' + (mk === false ? "on" : "") + '" data-act="anti-no" data-w="' + esc(w.w) + '">❌</button>' +
        "</span></div>"
      );
    }).join("");
    var marked = rv.words.filter(function (w) { return rv.marks[w.w] !== undefined; }).length;
    return (
      topbar("抗遗忘 · 第 " + rv.round + " 次", true) +
      '<div class="page">' +
      '<div class="card" style="display:flex;align-items:center;gap:10px">' +
      '<div style="flex:1;font-size:13px;color:var(--muted)">已标记 <b style="color:var(--brand)">' + marked + "</b> / " + rv.words.length + "</div>" +
      '<button class="btn btn-ghost mini" data-act="anti-quit">退出</button>' +
      "</div>" +
      '<div class="card">' + rows + "</div>" +
      '<button class="btn btn-primary btn-block" data-act="anti-submit"' + (marked === rv.words.length ? "" : " disabled") + ">提交</button></div>"
    );
  }
  function submitAnti() {
    var wrong = rv.words.filter(function (w) { return rv.marks[w.w] === false; });
    var ok = rv.words.length - wrong.length;
    var r = S.reviews.filter(function (x) { return x.id === rv.id; })[0];
    if (r) {
      r.status = "已完成";
      r.doneAt = todayKey();
      r.total = rv.words.length;
      r.correct = ok;
      r.wrongWords = wrong.map(function (w) { return w.w; });
      save();
    }
    rvResult = { ok: ok, total: rv.words.length, wrong: wrong };
    rv = null;
    sub = "antiDone";
    render();
  }
  function viewAntiDone() {
    var d = rvResult || { ok: 0, total: 0, wrong: [] };
    var pct = d.total ? Math.round((d.ok / d.total) * 100) : 0;
    var rows = d.wrong.length
      ? d.wrong.map(function (w) {
          return '<div class="word"><span class="en">' + esc(w.w) + '</span><span class="ph">' + esc(w.ph) + '</span><span class="cn">' + esc(w.m) + "</span></div>";
        }).join("")
      : empty("全部答对，太棒了 🎉");
    return (
      topbar("复习完成", true) +
      '<div class="page"><div class="stats">' +
      '<div class="stat"><b>' + d.ok + "</b><small>答对</small></div>" +
      '<div class="stat"><b>' + d.wrong.length + "</b><small>答错</small></div>" +
      '<div class="stat"><b>' + pct + "%</b><small>正确率</small></div></div>" +
      '<div class="sec-title">答错的单词（' + d.wrong.length + "）</div>" +
      '<div class="card">' + rows + "</div>" +
      '<div style="margin-top:12px"><button class="btn btn-primary btn-block" data-act="anti-back">返回抗遗忘</button></div></div>'
    );
  }

  /* ---------------- 智能练习 ---------------- */
  function startQuiz() {
    var pool = allLearnedWords();
    if (pool.length < 2) { toast("先学几个单词再来练习吧"); return; }
    var picked = pool.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 8);
    var qs = picked.map(function (w) {
      var others = pool.filter(function (x) { return x.m && x.m !== w.m; })
        .sort(function () { return Math.random() - 0.5; }).slice(0, 3).map(function (x) { return x.m; });
      var opts = [w.m].concat(others).sort(function () { return Math.random() - 0.5; });
      return { w: w.w, ph: w.ph, m: w.m, opts: opts };
    });
    quiz = { i: 0, right: 0, list: qs, picked: null };
    sub = "practice";
    render();
  }
  function viewPractice() {
    if (!quiz) {
      var n = allLearnedWords().length;
      return (
        topbar("智能练习", true) +
        '<div class="page"><div class="card" style="text-align:center;padding:26px 16px">' +
        '<div style="font-size:16px;font-weight:800">用已学单词做一组小测</div>' +
        '<div style="color:var(--muted);font-size:13px;margin:10px 0 18px">从你学过的 ' + n + " 个单词里随机抽 8 个，选出正确的中文意思</div>" +
        '<button class="btn btn-primary btn-block" data-act="quiz-start">开始练习</button></div></div>'
      );
    }
    if (quiz.i >= quiz.list.length) {
      var total = quiz.list.length;
      var pct = total ? Math.round((quiz.right / total) * 100) : 0;
      return (
        topbar("练习结果", true) +
        '<div class="page"><div class="stats">' +
        '<div class="stat"><b>' + quiz.right + "</b><small>答对</small></div>" +
        '<div class="stat"><b>' + (total - quiz.right) + "</b><small>答错</small></div>" +
        '<div class="stat"><b>' + pct + "%</b><small>正确率</small></div></div>" +
        '<div style="margin-top:14px"><button class="btn btn-primary btn-block" data-act="quiz-again">再练一组</button></div>' +
        '<div style="margin-top:10px"><button class="btn btn-ghost btn-block" data-act="back">返回</button></div></div>'
      );
    }
    var q = quiz.list[quiz.i];
    var opts = q.opts.map(function (m, k) {
      var cls = "";
      if (quiz.picked !== null) {
        if (m === q.m) cls = " ok";
        else if (k === quiz.picked) cls = " no";
      }
      return '<button class="opt' + cls + '" data-act="quiz-answer" data-k="' + k + '" data-m="' + esc(m) + '"' +
        (quiz.picked !== null ? " disabled" : "") + ">" + esc(m) + "</button>";
    }).join("");
    return (
      topbar("智能练习 · " + (quiz.i + 1) + "/" + quiz.list.length, true) +
      '<div class="page"><div class="card">' +
      '<div class="q">' + esc(q.w) + '</div><div class="qph">' + esc(q.ph) + "</div>" +
      '<div class="opts">' + opts + "</div>" +
      (quiz.picked !== null
        ? '<div style="margin-top:14px"><button class="btn btn-primary btn-block" data-act="quiz-next">' +
          (quiz.i + 1 >= quiz.list.length ? "看结果" : "下一题") + "</button></div>"
        : "") +
      "</div></div>"
    );
  }

  /* ---------------- 渲染 ---------------- */
  function body() {
    if (!me) return viewLogin();
    if (sub === "record") return viewRecordDetail();
    if (sub === "progress") return viewProgress();
    if (sub === "course") return viewCourse();
    if (sub === "favs") return viewFavs();
    if (sub === "anti") return viewAnti();
    if (sub === "antiDo") return viewAntiDo();
    if (sub === "antiDone") return viewAntiDone();
    if (sub === "practice") return viewPractice();
    if (tab === "record") return viewRecord();
    if (tab === "me") return viewMe();
    return viewHome();
  }
  function render() {
    document.getElementById("app").innerHTML = body();
    var bar = document.getElementById("tabbar");
    if (bar) {
      bar.classList.toggle("hide", !me);
      Array.prototype.slice.call(bar.querySelectorAll("button")).forEach(function (b) {
        b.classList.toggle("on", !sub && b.dataset.tab === tab);
      });
    }
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener("click", function (e) {
    var nav = e.target.closest("[data-tab]");
    if (nav) { tab = nav.dataset.tab; sub = null; render(); return; }
    var t = e.target.closest("[data-act]");
    if (!t) return;
    var a = t.dataset.act;
    if (a === "login") { doLogin(); return; }
    if (a === "logout") { logout(); return; }
    if (a === "back") {
      quiz = null;
      if (sub === "antiDo" || sub === "antiDone") { rv = null; rvResult = null; sub = "anti"; render(); return; }
      if (sub === "course") { sub = "progress"; render(); return; }
      sub = null; render(); return;
    }
    if (a === "go-progress") { sub = "progress"; render(); return; }
    if (a === "go-favs") { sub = "favs"; render(); return; }
    if (a === "go-anti") { sub = "anti"; render(); return; }
    if (a === "anti-start") { startAnti(t.dataset.id); return; }
    if (a === "anti-say") { speak(t.dataset.w); return; }
    if (a === "anti-ok" || a === "anti-no") {
      if (!rv) return;
      var wv = t.dataset.w, want = a === "anti-ok";
      if (rv.marks[wv] === want) delete rv.marks[wv];
      else rv.marks[wv] = want;
      render();
      return;
    }
    if (a === "anti-submit") { submitAnti(); return; }
    if (a === "anti-quit") { rv = null; sub = "anti"; render(); return; }
    if (a === "anti-back") { rvResult = null; sub = "anti"; render(); return; }
    if (a === "go-practice") { startQuiz(); return; }
    if (a === "open-course") { subArg = t.dataset.id; sub = "course"; render(); return; }
    if (a === "open-record") { subArg = t.dataset.id; sub = "record"; render(); return; }
    if (a === "fav") { toggleFav({ w: t.dataset.w, m: t.dataset.m || "", ph: t.dataset.ph || "" }); return; }
    if (a === "quiz-start") { startQuiz(); return; }
    if (a === "quiz-again") { quiz = null; startQuiz(); return; }
    if (a === "quiz-answer") {
      if (!quiz || quiz.picked !== null) return;
      var q = quiz.list[quiz.i];
      quiz.picked = Number(t.dataset.k);
      if (t.dataset.m === q.m) quiz.right += 1;
      render();
      return;
    }
    if (a === "quiz-next") { quiz.picked = null; quiz.i += 1; render(); return; }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && document.getElementById("lgUser") && me === null) doLogin();
  });

  /* ---------------- 启动 ---------------- */
  load();
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = pickVoice;
      pickVoice();
    }
  } catch (e) { /* ignore */ }
  try {
    var sid = localStorage.getItem(SESS);
    if (sid) me = S.students.filter(function (s) { return s.id === sid; })[0] || null;
  } catch (e) { /* ignore */ }
  render();
})();
