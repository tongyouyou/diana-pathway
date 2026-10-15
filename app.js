/* =========================================================
   蜗牛智学 · 教练端（网页版）
   带背流程：
     排课「上课」→ 选择该学员已开通词库 → 词库页(已学/剩余 + 学新/复习)
     学新：学前检测(全词库·只英文·对/叉) → 取打叉的最多30个·5个一组
       每组：识记 → 听音识义 → 乱序剪纸盒 → 正序剪纸盒 →(混合复习)→ 小结
       混合复习：第2组后①②，第3组后①②③，第4组后无，第5组后④⑤，第6组后④⑤⑥
     全部学完 → 学后检测(对/叉) → 继续学习 / 创建抗遗忘并下课
   发音一律英式（en-GB）
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- 工具 ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  const todayKey = () => ymd(new Date());
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const groupsOf = (list, size) => {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  };
  const dash = (v) => (v === 0 || v ? esc(v) : '<span style="color:var(--muted)">—</span>');

  const WEEK_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const SUBJECTS = ["单词"];
  const SUBJECT_ALL = SUBJECTS.concat(["全部"]);
  const TYPES = [
    { key: "60", label: "60分钟", min: 60 },
    { key: "试听", label: "体验课", min: 30 },
  ];
  const typeByKey = (k) => TYPES.find((t) => t.key === k) || TYPES[0];
  /* 抗遗忘：课后第 1/2/3 天连续复习，第 4 次与第 3 次隔一天，第 5 次再隔一天 */
  const ANTI_OFFSETS = [1, 2, 3, 5, 7];
  const GRADES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"];
  const MIX_AFTER = { 1: [0, 1], 2: [0, 1, 2], 4: [3, 4], 5: [3, 4, 5] }; // 0-based：第2/3/5/6组后

  /* ---------------- 词库 [单词, 音标, 中文, 例句] ---------------- */
  const WORD_BANK = [
    ["room", "/ruːm/", "房间", "This is my room. 这是我的房间。"],
    ["anxious", "/ˈæŋkʃəs/", "焦虑的", "She felt anxious before the exam. 考前她很焦虑。"],
    ["admit", "/ədˈmɪt/", "承认", "He admitted his mistake. 他承认了错误。"],
    ["burden", "/ˈbɜːdn/", "负担", "Don't carry the burden alone. 别独自承担。"],
    ["achieve", "/əˈtʃiːv/", "实现；达到", "You can achieve your goal. 你能实现目标。"],
    ["benefit", "/ˈbenɪfɪt/", "益处；受益", "Exercise benefits health. 运动有益健康。"],
    ["climate", "/ˈklaɪmət/", "气候", "The climate is changing. 气候正在变化。"],
    ["decline", "/dɪˈklaɪn/", "下降；婉拒", "Sales declined last year. 去年销量下降。"],
    ["effort", "/ˈefət/", "努力", "Make an effort every day. 每天努力一点。"],
    ["fragile", "/ˈfrædʒaɪl/", "易碎的", "Handle the glass; it's fragile. 小心，玻璃易碎。"],
    ["generate", "/ˈdʒenəreɪt/", "产生", "Wind can generate power. 风能可以发电。"],
    ["harvest", "/ˈhɑːvɪst/", "收获", "Autumn is the harvest season. 秋天是收获季。"],
    ["identify", "/aɪˈdentɪfaɪ/", "识别", "Can you identify the word? 你能认出这个词吗？"],
    ["journey", "/ˈdʒɜːni/", "旅程", "We had a long journey. 我们的旅程很长。"],
    ["knowledge", "/ˈnɒlɪdʒ/", "知识", "Knowledge is power. 知识就是力量。"],
    ["landscape", "/ˈlændskeɪp/", "风景；景观", "The landscape is beautiful. 景色很美。"],
    ["maintain", "/meɪnˈteɪn/", "维持；保养", "Maintain a good habit. 保持好习惯。"],
    ["negative", "/ˈneɡətɪv/", "消极的", "Don't be so negative. 别这么消极。"],
    ["obvious", "/ˈɒbviəs/", "明显的", "It is obvious that he is right. 显然他是对的。"],
    ["persuade", "/pəˈsweɪd/", "说服", "She persuaded me to go. 她说服我去了。"],
    ["quantity", "/ˈkwɒntəti/", "数量", "We need a large quantity. 我们需要大量。"],
    ["reduce", "/rɪˈdjuːs/", "减少", "Reduce your screen time. 减少屏幕时间。"],
    ["struggle", "/ˈstrʌɡl/", "挣扎；奋斗", "He struggled to stand up. 他挣扎着站起。"],
    ["tolerate", "/ˈtɒləreɪt/", "容忍", "I can't tolerate the noise. 我无法容忍噪音。"],
    ["unique", "/juˈniːk/", "独特的", "Everyone is unique. 每个人都是独特的。"],
    ["vivid", "/ˈvɪvɪd/", "生动的", "She has a vivid memory. 她记忆生动。"],
    ["witness", "/ˈwɪtnəs/", "目击；证人", "He witnessed the accident. 他目击了事故。"],
    ["yield", "/jiːld/", "产出；屈服", "The farm yields rice. 农场出产大米。"],
    ["accurate", "/ˈækjərət/", "准确的", "Give me an accurate answer. 给我准确答案。"],
    ["balance", "/ˈbæləns/", "平衡", "Keep a balance in life. 保持生活平衡。"],
    ["capable", "/ˈkeɪpəbl/", "有能力的", "She is capable of it. 她有能力做到。"],
    ["delicate", "/ˈdelɪkət/", "精致的；微妙的", "A delicate flower. 一朵精致的花。"],
    ["emphasize", "/ˈemfəsaɪz/", "强调", "He emphasized the point. 他强调这一点。"],
    ["familiar", "/fəˈmɪliə/", "熟悉的", "The song sounds familiar. 这首歌听起来很熟。"],
    ["genuine", "/ˈdʒenjuɪn/", "真正的", "A genuine smile. 真诚的微笑。"],
    ["hesitate", "/ˈhezɪteɪt/", "犹豫", "Don't hesitate to ask. 别犹豫，尽管问。"],
    ["influence", "/ˈɪnfluəns/", "影响", "Teachers influence students. 老师影响学生。"],
    ["justify", "/ˈdʒʌstɪfaɪ/", "证明…正当", "How do you justify it? 你怎么证明其正当？"],
    ["keen", "/kiːn/", "热衷的；敏锐的", "He is keen on music. 他热衷音乐。"],
    ["launch", "/lɔːntʃ/", "发起；发射", "They launched a new app. 他们发布新应用。"],
    ["modest", "/ˈmɒdɪst/", "谦虚的；适度的", "He is modest about success. 他对成功很谦虚。"],
    ["neglect", "/nɪˈɡlekt/", "忽视", "Don't neglect your health. 别忽视健康。"],
    ["obtain", "/əbˈteɪn/", "获得", "Obtain a driving licence. 取得驾照。"],
    ["previous", "/ˈpriːviəs/", "先前的", "The previous lesson was easy. 上一课很简单。"],
    ["reluctant", "/rɪˈlʌktənt/", "不情愿的", "He was reluctant to leave. 他不愿离开。"],
    ["sustain", "/səˈsteɪn/", "维持", "Sustain the speed. 保持速度。"],
    ["tremendous", "/trəˈmendəs/", "巨大的", "A tremendous success. 巨大的成功。"],
    ["urgent", "/ˈɜːdʒənt/", "紧急的", "It is an urgent task. 这是紧急任务。"],
    ["various", "/ˈveəriəs/", "各种各样的", "Various choices. 多种选择。"],
    ["wander", "/ˈwɒndə/", "漫步；徘徊", "We wandered in the park. 我们在公园漫步。"],
    ["abandon", "/əˈbændən/", "放弃；抛弃", "Never abandon hope. 永不放弃希望。"],
    ["brilliant", "/ˈbrɪliənt/", "杰出的；明亮的", "A brilliant idea. 绝妙的主意。"],
    ["crucial", "/ˈkruːʃl/", "至关重要的", "This step is crucial. 这一步至关重要。"],
    ["diligent", "/ˈdɪlɪdʒənt/", "勤勉的", "She is a diligent student. 她是个勤勉的学生。"],
    ["elaborate", "/ɪˈlæbərət/", "精心制作的；详述", "An elaborate plan. 精心制定的计划。"],
    ["fortunate", "/ˈfɔːtʃənət/", "幸运的", "I was fortunate to meet you. 认识你很幸运。"],
    ["glimpse", "/ɡlɪmps/", "一瞥", "I caught a glimpse of him. 我瞥见了他。"],
    ["horizon", "/həˈraɪzn/", "地平线", "The sun sank below the horizon. 太阳落下地平线。"],
    ["innocent", "/ˈɪnəsnt/", "无辜的；天真的", "An innocent child. 天真的孩子。"],
    ["luxury", "/ˈlʌkʃəri/", "奢侈；奢华", "A luxury hotel. 豪华酒店。"],
    ["mature", "/məˈtʃʊə/", "成熟的", "He is very mature. 他很成熟。"],
    ["notion", "/ˈnəʊʃn/", "概念；想法", "I have no notion of it. 我对此毫无概念。"],
    ["precise", "/prɪˈsaɪs/", "精确的", "Precise measurement. 精确的测量。"],
    ["reliable", "/rɪˈlaɪəbl/", "可靠的", "A reliable friend. 可靠的朋友。"],
    ["sincere", "/sɪnˈsɪə/", "真诚的", "Sincere thanks. 真诚的感谢。"],
    ["thorough", "/ˈθʌrə/", "彻底的", "A thorough check. 彻底的检查。"],
    ["vanish", "/ˈvænɪʃ/", "消失", "The fog vanished. 雾散了。"],
    ["wisdom", "/ˈwɪzdəm/", "智慧", "Words of wisdom. 智慧之言。"],
  ];

  /* ---------------- 词库（可在「词库」页创建 / 上传） ---------------- */
  const SEED_COURSE_DEFS = [
    { id: "c1", name: "人教版 · 必修一 Unit 1", size: 20 },
    { id: "c2", name: "人教版 · 必修一 Unit 2", size: 20 },
    { id: "c3", name: "新概念英语 · 第一册 Lesson 1-10", size: 24 },
    { id: "c4", name: "中考核心词汇 · 高频 300", size: 30 },
    { id: "c5", name: "高考核心词汇 3500 · 精选", size: 28 },
  ];
  function seedCourses() {
    return SEED_COURSE_DEFS.map(function (def, idx) {
      const words = [];
      for (let i = 0; i < def.size; i++) {
        const t = WORD_BANK[(idx * 9 + i) % WORD_BANK.length];
        words.push({ w: t[0], ph: t[1], m: t[2], ex: t[3] });
      }
      return { id: def.id, name: def.name, words: words, createdAt: todayKey() };
    });
  }
  const courseById = (id) => S.courses.find((c) => c.id === id);
  const courseWords = (course) => (course && course.words ? course.words : []);
  const courseSize = (course) => courseWords(course).length;
  const courseName = (id) => {
    const c = courseById(id);
    return c ? c.name : "未指定词库";
  };
  function parseWords(text) {
    const out = [];
    String(text || "").split(/\r?\n/).forEach(function (line, idx) {
      const s = line.replace(/\uFEFF/g, "").trim();
      if (!s) return;
      let raw;
      if (s.indexOf("\t") >= 0) raw = s.split("\t");
      else if (s.indexOf(",") >= 0) raw = s.split(",");
      else if (s.indexOf("，") >= 0) raw = s.split("，");
      else raw = [s];
      const parts = raw.map((x) => x.trim()).filter((x) => x !== "");
      if (!parts.length) return;
      if (idx === 0 && /^(英文|单词|word|english)/i.test(parts[0])) return; // 跳过表头
      if (parts.length >= 3) out.push({ w: parts[0], ph: parts[1], m: parts[2] });
      else if (parts.length === 2) {
        if (/^\/.*\/$/.test(parts[1])) out.push({ w: parts[0], ph: parts[1], m: "" });
        else out.push({ w: parts[0], ph: "", m: parts[1] });
      } else out.push({ w: parts[0], ph: "", m: "" });
    });
    return out;
  }
  const makeOptions = (word) => {
    const others = shuffle(WORD_BANK.filter((x) => x[2] !== word.m)).slice(0, 3).map((x) => x[2]);
    return shuffle([word.m].concat(others));
  };

  /* ---------------- 学员种子 ---------------- */
  const SEED_STUDENTS = [
    ["童思怡", 32, ["c1", "c2"]], ["李齐萱", 1, []], ["乐乐", 0, []], ["钱可芯", 0, []], ["张桐语", 0, []],
    ["许尘然", 0, []], ["陆思淼", 2, ["c3"]], ["吴笑珏", 8, ["c1"]], ["付博闻", 0, []], ["赵桐", 0, []],
    ["孙清扬", 0, []], ["伊赫", 0, []], ["卢镜如", 1, []], ["董天翊", 0, []], ["董其彰", 0, []],
  ];

  /* ---------------- 状态 ---------------- */
  const KEY = "wn-word-coach-v4";
  /* ---------------- 云端同步（多人共用） ----------------
     CLOUD_MODE = false → 纯本地模式（双击 index.html，数据存浏览器）
     CLOUD_MODE = true  → 云端模式（数据存后台，多人共用同一份）
     CLOUD_API  = ""    → 后台与网页同一个地址（推荐）
     CLOUD_API  = "https://xxx" → 后台在别的地址时填这里 */
  const CLOUD_MODE = false;
  const CLOUD_API = "";
  const CLOUD_TOKEN_KEY = "wn-cloud-token";
  const LOCAL_ONLY = ["user", "sidebarCollapsed"];   // 这两项不参与云端共享
  let cloudRev = 0;
  let cloudTimer = null;
  let cloudPushing = false;

  function cloudToken() { try { return localStorage.getItem(CLOUD_TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setCloudToken(t) {
    try { if (t) localStorage.setItem(CLOUD_TOKEN_KEY, t); else localStorage.removeItem(CLOUD_TOKEN_KEY); } catch (e) { /* ignore */ }
  }
  function api(path, opts) {
    opts = opts || {};
    const headers = { "Content-Type": "application/json" };
    const tk = cloudToken();
    if (tk) headers.Authorization = "Bearer " + tk;
    return fetch(CLOUD_API + path, { method: opts.method || "GET", headers: headers, body: opts.body })
      .then(function (res) {
        return res.text().then(function (txt) {
          let j = null;
          try { j = JSON.parse(txt); } catch (e) { j = null; }
          return { status: res.status, body: j };
        });
      })
      .catch(function () { return { status: 0, body: null }; });
  }
  function shareable() {
    const out = {};
    Object.keys(S || {}).forEach(function (k) { if (LOCAL_ONLY.indexOf(k) < 0) out[k] = S[k]; });
    return out;
  }
  function normalize(s) {
    if (!s.progress) s.progress = {};
    if (!Array.isArray(s.reviews)) s.reviews = [];
    if (!Array.isArray(s.records)) s.records = [];
    if (!Array.isArray(s.classes)) s.classes = [];
    if (!s.courses || !s.courses.length) s.courses = seedCourses();
    if (!s.coaches || !s.coaches.length) s.coaches = SEED_COACHES.map((c) => Object.assign({}, c, { joinedAt: todayKey() }));
    return s;
  }
  function cloudPull() {
    if (!CLOUD_MODE) return Promise.resolve(false);
    return api("/api/state").then(function (r) {
      if (r.status === 200 && r.body && r.body.data) {
        const keepUser = S ? S.user : null;
        const keepSide = S ? !!S.sidebarCollapsed : false;
        S = normalize(r.body.data);
        S.user = keepUser || null;
        S.sidebarCollapsed = keepSide;
        cloudRev = r.body.rev || 0;
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
        return true;
      }
      if (r.status === 404) return cloudPush(true).then(function () { return true; });
      return false;
    });
  }
  function cloudPush(force) {
    if (!CLOUD_MODE) return Promise.resolve(false);
    cloudPushing = true;
    return api("/api/state", { method: "PUT", body: JSON.stringify({ rev: force ? 0 : cloudRev, data: shareable() }) })
      .then(function (r) {
        cloudPushing = false;
        if (r.status === 200 && r.body) { cloudRev = r.body.rev || cloudRev; return true; }
        if (r.status === 409) {
          return cloudPull().then(function () { render(); toast("云端数据已被更新，已同步最新版本"); return false; });
        }
        if (r.status === 401) setCloudToken("");
        toast("同步到云端失败，请检查网络");
        return false;
      });
  }
  function cloudSchedule() {
    if (!CLOUD_MODE) return;
    if (cloudTimer) clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () { cloudTimer = null; cloudPush(); }, 700);
  }
  let S = null;
  let route = { name: "dashboard", day: todayKey(), subject: "单词" };
  let weekOffset = 0;
  let lesson = null;
  let pending = null;            // {studentId, classId}
  let currentCourseId = null;
  let currentCourseStudentId = null;
  let currentStudentId = null;
  let stuSearch = "";
  let navSuperviseOpen = false;
  let grantDraft = [];
  let breakTimer = null;
  let breakRemaining = 5 * 60 * 1000;
  let breakRunning = false;

  function defaultState() {
    const seed = window.__SEED__;
    if (seed && Array.isArray(seed.students)) {
      const s = JSON.parse(JSON.stringify(seed));
      s.user = null;
      if (!s.progress) s.progress = {};
      if (!Array.isArray(s.wrong)) s.wrong = [];
      if (!Array.isArray(s.records)) s.records = [];
      if (!Array.isArray(s.classes)) s.classes = [];
      if (!Array.isArray(s.reviews)) s.reviews = [];
      if (!s.courses || !s.courses.length) s.courses = seedCourses();
      if (!s.coaches || !s.coaches.length) s.coaches = SEED_COACHES.map((c) => Object.assign({}, c, { joinedAt: todayKey() }));
      return s;
    }
    const students = SEED_STUDENTS.map(([name, hours, courses]) => ({
      id: uid(), name: name, phone: "", grade: "", school: "", remark: "",
      hours: hours, status: "正常", courses: courses.slice(), joinedAt: todayKey(), rechargeLog: [],
    }));
    const byName = (n) => (students.find((s) => s.name === n) || {}).id;
    const d0 = todayKey();
    const d1 = ymd(new Date(Date.now() + 86400000));
    return {
      students: students,
      classes: [
        { id: uid(), studentId: byName("童思怡"), date: d0, time: "16:00", type: "60", subject: "单词", status: "待上课" },
        { id: uid(), studentId: byName("吴笑珏"), date: d0, time: "18:30", type: "60", subject: "单词", status: "待上课" },
        { id: uid(), studentId: byName("陆思淼"), date: d1, time: "17:00", type: "60", subject: "单词", status: "待上课" },
        { id: uid(), studentId: byName("李齐萱"), date: d1, time: "19:00", type: "60", subject: "单词", status: "待上课" },
      ],
      records: [], wrong: [], progress: {},
      courses: seedCourses(),
      coaches: SEED_COACHES.map((c) => Object.assign({}, c, { joinedAt: todayKey() })),
    };
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (!s.progress) s.progress = {};
        if (!s.courses || !s.courses.length) s.courses = seedCourses();
        if (!s.coaches || !s.coaches.length) s.coaches = SEED_COACHES.map((c) => Object.assign({}, c, { joinedAt: todayKey() }));
        if (!Array.isArray(s.reviews)) s.reviews = [];
        return s;
      }
    } catch (e) { /* ignore */ }
    const s = defaultState();
    saveState(s);
    return s;
  }
  function saveState() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    cloudSchedule();
  }
  const studentById = (id) => S.students.find((s) => s.id === id);
  const progKey = (studentId, courseId) => (studentId || "shared") + "::" + courseId;
  const courseProgress = (studentId, courseId) => S.progress[progKey(studentId, courseId)] || { learned: [], wrong: [] };
  function learnedSet(studentId, courseId) {
    const c = courseById(courseId);
    const ids = {};
    if (c) courseWords(c).forEach((w) => { ids[w.w] = 1; });
    const set = {};
    const p = courseProgress(studentId, courseId);
    (p.learned || []).concat(p.known || []).forEach((w) => { if (ids[w]) set[w] = 1; });
    return set;
  }
  const learnedCount = (studentId, courseId) => Object.keys(learnedSet(studentId, courseId)).length;
  const courseStudent = () => studentById(pending ? pending.studentId : currentCourseStudentId);

  function toast(msg) {
    const root = document.getElementById("toastRoot");
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.remove(), 2100);
  }
  /* ---------------- 顶栏 / 登录 ---------------- */
  const SEED_COACHES = [{ name: "Diana", pass: "123456" }];
  function renderHeader() {
    const box = document.getElementById("headerRight");
    if (!box) return;
    const u = S && S.user;
    box.innerHTML =
      (u
        ? '<span class="header-user">' + esc(u.name) + '</span>' +
          '<button class="header-btn" data-action="logout">退出</button>'
        : '<button class="header-btn" data-action="login">登录</button>');
  }
  function openLogin() {
    openModal(
      '<div class="modal-head">登录 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>账号</label><input id="loginUser" placeholder="请输入账号" /></div>' +
      '<div class="field"><label>密码</label><input id="loginPass" type="password" placeholder="请输入密码" /></div>' +
      '<p style="color:var(--muted);font-size:12px;margin:0">演示账号：<b>Diana</b> / <b>123456</b></p>' +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-action="do-login">登录</button></div>'
    );
    const i = document.getElementById("loginUser");
    if (i) i.focus();
  }
  function doLogin() {
    const uEl = document.getElementById("loginUser");
    const pEl = document.getElementById("loginPass");
    const u = uEl ? uEl.value.trim() : "";
    const p = pEl ? pEl.value : "";
    const coach = (S.coaches || []).find((c) => c.name === u);
    if (coach && coach.pass === p) {
      S.user = { name: u, at: todayKey() };
      saveState();
      closeModal();
      renderHeader();
      render();
      toast("登录成功，欢迎 " + u);
    } else {
      toast("账号或密码不正确");
    }
  }
  function doLogout() {
    S.user = null;
    setCloudToken("");
    saveState();
    renderHeader();
    renderLoginGate();
    toast("已退出登录");
  }
  /* ---------------- 登录门（打开网页必须先登录） ---------------- */
  function renderLoginGate() {
    const existing = document.getElementById("loginGate");
    if (S && S.user) { if (existing) existing.remove(); return; }
    if (existing) return;
    const gate = document.createElement("div");
    gate.id = "loginGate";
    gate.className = "login-gate";
    gate.innerHTML =
      '<div class="login-card">' +
      '<div class="login-logo">Diana\'s Pathway</div>' +
      '<div class="login-tip">请登录后使用</div>' +
      '<div class="field"><label>账号</label><input id="gateUser" placeholder="请输入账号" autocomplete="username" /></div>' +
      '<div class="field"><label>密码</label><input id="gatePass" type="password" placeholder="请输入密码" autocomplete="current-password" /></div>' +
      '<div class="login-err" id="gateErr"></div>' +
      '<button class="btn btn-primary btn-block" data-action="gate-login">登录</button>' +
      "</div>";
    document.body.appendChild(gate);
    const uEl = document.getElementById("gateUser");
    if (uEl) uEl.focus();
    const pEl = document.getElementById("gatePass");
    if (pEl) pEl.addEventListener("keydown", function (ev) { if (ev.key === "Enter") doGateLogin(); });
  }
  function doGateLogin() {
    const uEl = document.getElementById("gateUser");
    const pEl = document.getElementById("gatePass");
    const eEl = document.getElementById("gateErr");
    const u = uEl ? uEl.value.trim() : "";
    const p = pEl ? pEl.value : "";
    const fail = function (msg) {
      if (eEl) eEl.textContent = msg;
      if (pEl) { pEl.value = ""; pEl.focus(); }
    };
    if (CLOUD_MODE) {
      if (eEl) eEl.textContent = "正在登录…";
      api("/api/login", { method: "POST", body: JSON.stringify({ name: u, pass: p }) }).then(function (r) {
        if (r.status !== 200 || !r.body || !r.body.token) {
          fail(r.status === 401 ? "账号或密码不正确" : "登录失败，请检查网络后重试");
          return;
        }
        setCloudToken(r.body.token);
        return cloudPull().then(function () {
          S.user = { name: u, at: todayKey() };
          if (eEl) eEl.textContent = "";
          renderLoginGate();
          renderHeader();
          render();
          toast("登录成功，欢迎 " + u);
        });
      });
      return;
    }
    const coach = (S.coaches || []).find((c) => c.name === u);
    if (coach && coach.pass === p) {
      S.user = { name: u, at: todayKey() };
      saveState();
      if (eEl) eEl.textContent = "";
      renderLoginGate();
      renderHeader();
      render();
      toast("登录成功，欢迎 " + u);
    } else {
      if (eEl) eEl.textContent = "账号或密码不正确";
      if (pEl) { pEl.value = ""; pEl.focus(); }
    }
  }
  /* ---------------- 存储可用性提醒 ---------------- */
  /* ---------------- 账号角色（管理员 / 教练） ---------------- */
  const ADMIN_ONLY_ROUTES = ["dashboard", "library", "coaches"];
  const ADMIN_ONLY_NAV = ["dashboard", "library", "coaches"];
  function ensureRoles() {
    let changed = false;
    (S.coaches || []).forEach((c) => { if (!c.role) { c.role = "admin"; changed = true; } });
    return changed;
  }
  function currentCoach() {
    const u = S && S.user;
    if (!u) return null;
    return (S.coaches || []).find((c) => c.name === u.name) || null;
  }
  function isAdmin() {
    const c = currentCoach();
    return !c || !c.role || c.role === "admin";
  }
  function adminCount() {
    return (S.coaches || []).filter((c) => !c.role || c.role === "admin").length;
  }
  /* 课表信息里每个人都只看自己名下的排课（管理员要看全部请用「控制台」的排课管理） */
  function visibleClasses() {
    const me = (S.user && S.user.name) || "";
    return (S.classes || []).filter((c) => (c.coach || "Diana") === me);
  }
  /* 管理员看全部销课记录；教练只看自己名下的记录 */
  function visibleRecords() {
    if (isAdmin()) return S.records;
    const me = (S.user && S.user.name) || "";
    return S.records.filter((r) => (r.coach || "Diana") === me);
  }
  /* 管理员看全部抗遗忘；教练只看自己名下的 */
  /* 管理员看全部学员；教练只看名下有排课 / 销课记录的学员 */
  function visibleStudents() {
    const all = S.students || [];
    if (isAdmin()) return all;
    const me = (S.user && S.user.name) || "";
    const ids = {};
    (S.classes || []).forEach((c) => { if ((c.coach || "Diana") === me) ids[c.studentId] = 1; });
    (S.records || []).forEach((r) => { if ((r.coach || "Diana") === me) ids[r.studentId] = 1; });
    return all.filter((s) => ids[s.id]);
  }
  function canViewStudent(id) {
    return isAdmin() || visibleStudents().some((s) => s.id === id);
  }
  function visibleReviews() {
    const all = (S.reviews || []).filter((r) => (S.records || []).some((x) => x.id === r.recordId));
    if (isAdmin()) return all;
    const me = (S.user && S.user.name) || "";
    return all.filter((r) => (r.coach || "Diana") === me);
  }
  function reviewRecord(r) {
    return (S.records || []).find((x) => x.id === r.recordId) || null;
  }
  function addDaysKey(dateKey, n) {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  /* 销课后自动生成 5 次抗遗忘复习 */
  function createAntiReviews(rec) {
    S.reviews = S.reviews || [];
    ANTI_OFFSETS.forEach(function (off, i) {
      S.reviews.push({
        id: uid(), recordId: rec.id, studentId: rec.studentId, courseId: rec.courseId,
        student: rec.student, course: rec.course, coach: rec.coach || "Diana",
        round: i + 1, date: addDaysKey(rec.date, off), status: "待复习",
      });
    });
  }
  function applyNavRole() {
    const admin = isAdmin();
    $$("#tabbar .tab").forEach(function (b) {
      const allowed = admin || ADMIN_ONLY_NAV.indexOf(b.dataset.nav) < 0;
      b.style.display = allowed ? "" : "none";
    });
  }
  /* 督学管理：点击展开 / 收起子项「抗遗忘」 */
  function applyNavGroups() {
    const sub = document.getElementById("navSubSupervise");
    const btn = document.querySelector('[data-nav-parent="supervise"]');
    if (!sub || !btn) return;
    const open = !!navSuperviseOpen;
    const active = route.name === "review" || route.name === "anti";
    sub.classList.toggle("is-open", open);
    btn.classList.toggle("is-open", open);
    btn.classList.toggle("has-active", active);
  }
  function toggleSupervise() {
    navSuperviseOpen = !navSuperviseOpen;
    applyNavGroups();
  }
  function storageAvailable() {
    try {
      localStorage.setItem("__probe__", "1");
      localStorage.removeItem("__probe__");
      return true;
    } catch (e) { return false; }
  }
  function renderStorageWarning() {
    if (storageAvailable() || document.getElementById("storageWarn")) return;
    const bar = document.createElement("div");
    bar.id = "storageWarn";
    bar.className = "storage-warn";
    bar.innerHTML = "⚠️ 当前浏览器无法保存数据，刷新后改动会丢失。请改用 <b>Chrome</b> 打开本页，或通过本地地址 <b>http://127.0.0.1:8777/</b> 使用。";
    const shell = document.querySelector(".app-shell");
    const body = document.querySelector(".app-body");
    if (shell && body) shell.insertBefore(bar, body);
  }
  /* ---------------- 数据备份 / 恢复 ---------------- */
  function openBackup() {
    const json = JSON.stringify(S, null, 2);
    openModal(
      '<div class="modal-head">备份数据 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<p style="color:var(--muted);font-size:12.5px;line-height:1.7;margin:0 0 8px">' +
      "把下面全部内容复制出来存成文件。换电脑 / 换浏览器 / 重装后用「恢复数据」粘贴回来即可。</p>" +
      '<textarea class="input" id="bkText" rows="10" readonly>' + esc(json) + "</textarea>" +
      '<div style="font-size:12px;color:var(--muted);margin-top:8px">' +
      "备份内容：" + (S.students || []).length + " 名学员 · " + (S.coaches || []).length + " 名教练 · " +
      (S.courses || []).length + " 个词库 · " + (S.classes || []).length + " 节排课 · " +
      (S.records || []).length + " 条销课记录</div>" +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button>' +
      '<button class="btn btn-primary" data-action="copy-backup">全选并复制</button></div>'
    );
    const t = document.getElementById("bkText");
    if (t) { t.focus(); t.select(); }
  }
  function copyBackup() {
    const t = document.getElementById("bkText");
    if (!t) return;
    t.focus();
    t.select();
    try { document.execCommand("copy"); toast("已复制，粘贴到文件里保存即可"); }
    catch (e) { toast("请手动全选复制"); }
  }
  /* ---------------- 导出给家长端小程序 ---------------- */
  function miniPayload() {
    const recs = visibleRecords();
    const byName = {};
    (S.students || []).forEach((s) => { byName[s.name] = s; });
    return {
      type: "diana-pathway",
      version: 1,
      exportedAt: todayKey(),
      students: visibleStudents().map(function (s) {
        return { name: s.name, phone: s.phone || "", grade: s.grade || "", school: s.school || "", pass: s.pass || "" };
      }),
      records: recs.map(function (r) {
        const s = byName[r.student] || {};
        return {
          id: r.id, date: r.date, student: r.student, phone: s.phone || "",
          course: r.course || r.subject, type: r.type, minutes: r.minutes || 0,
          correct: r.correct || 0, total: r.total || 0,
          words: (r.words || []).map((w) => ({ w: w.w, ph: w.ph, m: w.m })),
          coach: r.coach || "",
        };
      }),
    };
  }
  function openMiniExport() {
    const p = miniPayload();
    const json = JSON.stringify(p);
    openModal(
      '<div class="modal-head">导出给小程序 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<p style="color:var(--muted);font-size:12.5px;line-height:1.7;margin:0 0 8px">' +
      "点「全选并复制」，到小程序里打开「销课记录 → 导入」，点「读取剪贴板」再点「导入」即可。" +
      "（如果手机和电脑不在一起，可以把这段内容先发到微信里，手机上长按复制同样可以。）</p>" +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">本次导出：' +
      p.records.length + " 条销课记录 · " + p.students.length + " 名学员</div>" +
      '<textarea class="input" id="miniText" rows="9" readonly>' + esc(json) + "</textarea>" +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button>' +
      '<button class="btn btn-primary" data-action="copy-mini">全选并复制</button></div>'
    );
    const t = document.getElementById("miniText");
    if (t) { t.focus(); t.select(); }
  }
  function copyMini() {
    const t = document.getElementById("miniText");
    if (!t) return;
    t.focus();
    t.select();
    try { document.execCommand("copy"); toast("已复制，去小程序里导入吧"); }
    catch (e) { toast("请手动全选复制"); }
  }
  function openRestore() {
    openModal(
      '<div class="modal-head">恢复数据 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<p style="color:var(--muted);font-size:12.5px;line-height:1.7;margin:0 0 8px">' +
      "把之前备份的内容粘贴到下面，点「恢复」会<b>覆盖</b>当前数据。</p>" +
      '<textarea class="input" id="rsText" rows="10" placeholder="粘贴备份内容"></textarea>' +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-action="do-restore">恢复</button></div>'
    );
  }
  function doRestore() {
    const el = document.getElementById("rsText");
    const raw = el ? el.value.trim() : "";
    if (!raw) { toast("请先粘贴备份内容"); return; }
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { toast("内容不是有效的备份数据"); return; }
    if (!obj || !Array.isArray(obj.students)) { toast("备份数据格式不正确"); return; }
    if (!confirm("确定用这份备份覆盖当前数据吗？（当前数据会被替换）")) return;
    S = Object.assign({ classes: [], records: [], wrong: [], progress: {}, courses: [], coaches: [] }, obj);
    ensureRoles();
    saveState();
    closeModal();
    route.name = "me";
    render();
    toast("已恢复数据");
  }
  function applySidebar() {
    const body = document.querySelector(".app-body");
    if (!body) return;
    const collapsed = !!S.sidebarCollapsed;
    body.classList.toggle("is-collapsed", collapsed);
    $$("#tabbar .tab").forEach(function (b) {
      const span = b.querySelector("span");
      if (collapsed && span) b.setAttribute("title", span.textContent.trim());
      else b.removeAttribute("title");
    });
  }
  let voiceGB = null;
  function pickVoice() {
    try {
      const vs = window.speechSynthesis.getVoices() || [];
      voiceGB = vs.find((v) => /en[-_]GB/i.test(v.lang)) || vs.find((v) => /english \(united kingdom\)|kate|daniel|serena|arthur/i.test(v.name)) || null;
    } catch (e) { voiceGB = null; }
  }
  function speak(text) {
    try {
      if (!("speechSynthesis" in window)) { toast("当前环境不支持发音"); return; }
      if (!voiceGB) pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
      u.rate = 0.9;
      if (voiceGB) u.voice = voiceGB;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  function downloadCSV(filename, rows) {
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c == null ? "" : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  /* ---------------- 排课 ---------------- */
  function weekStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow + weekOffset * 7);
    return d;
  }
  function weekDates() {
    const s = weekStart();
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
  }
  function statusBadge(status) {
    if (status === "进行中") return '<span class="badge live">进行中</span>';
    if (status === "已完成") return '<span class="badge done">已下课</span>';
    return '<span class="badge wait">待上课</span>';
  }
  function classCard(c, showDate) {
    const stu = studentById(c.studentId);
    const type = typeByKey(c.type);
    const badge = statusBadge(c.status);
    return (
      '<div class="card"><div class="class-card">' +
      '<div class="class-time">' + (showDate ? "<em>" + esc(c.date.slice(5)) + "</em>" : "") +
      "<b>" + esc(c.time) + "</b><span>" + type.label + "</span></div>" +
      '<div class="class-main"><div class="who"><span class="avatar">' +
      (stu ? esc(stu.name.slice(0, 1)) : "?") + "</span>" + (stu ? esc(stu.name) : "未知学员") +
      badge + "</div></div>" +
      '<div class="class-actions">' +
      (c.status !== "已完成"
        ? '<button class="btn btn-primary" data-action="start-class" data-id="' + c.id + '">上课</button>'
        : '<button class="btn btn-ghost" disabled>已下课</button>') +
      "</div></div></div>"
    );
  }
  function viewSchedule() {
    const days = weekDates();
    const mine = visibleClasses();
    const monthLabel = days[0].getFullYear() + "年" + (days[0].getMonth() + 1) + "月";
    const activeIdx = Math.max(0, days.findIndex((d) => ymd(d) === route.day));
    const dayCells = days.map(function (d) {
      const key = ymd(d);
      const cls = ["day"];
      if (key === todayKey()) cls.push("is-today");
      if (key === route.day) cls.push("is-active");
      if (mine.some((c) => c.date === key)) cls.push("has-class");
      return '<button class="' + cls.join(" ") + '" data-action="pick-day" data-date="' + key + '">' +
        '<span class="dw">' + WEEK_CN[d.getDay()] + '</span><span class="dd">' + d.getDate() + '</span><i class="dot"></i></button>';
    }).join("");
    const allMode = route.subject === "全部";
    const list = mine
      .filter((c) => allMode || (c.date === route.day && c.subject === route.subject))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const cards = list.length
      ? '<div class="sched-grid">' + list.map((c, i) =>
          '<div class="sched-item" style="animation-delay:' + Math.min(i * 45, 320) + 'ms">' +
          classCard(c, allMode) + "</div>").join("") + "</div>"
      : '<div class="card"><div class="empty">暂无更多课表~</div></div>';
    return (
      pageHead("课表信息") +
      '<div class="sched-page">' +
      '<div class="weekbar"><div class="month">' + monthLabel + "</div>" +
      '<div class="nav"><button data-action="week-prev">‹</button><button data-action="week-next">›</button></div></div>' +
      '<div class="days-wrap"><div class="days" style="--di:' + activeIdx + '">' +
      '<span class="pill"></span>' + dayCells + "</div></div>" +
      '<div class="subjects">' + SUBJECT_ALL.map((s) =>
        '<button class="subj ' + (route.subject === s ? "is-active" : "") + '" data-action="pick-subject" data-subject="' + s + '">' + s + "</button>"
      ).join("") + "</div>" +
      '<div class="section-title">' + (allMode
        ? "全部课程 · 共 " + list.length + " 节"
        : route.subject + " · " + route.day.slice(5)) + "</div>" +
      cards + "</div>"
    );
  }

  /* ---------------- 选择词库（该学员已开通） ---------------- */
  function viewTeach() {
    const stu = pending ? studentById(pending.studentId) : null;
    if (!stu) {
      return '<div class="card"><div class="empty">请从「排课」里点某个学员的「上课」进入</div></div>';
    }
    const ids = stu.courses || [];
    const cards = ids.length
      ? ids.map(courseById).filter(Boolean).map(function (c) {
          const learned = learnedCount(stu.id, c.id);
          return (
            '<div class="card"><div class="course-card">' +
            '<div class="ci">' + esc(c.name.slice(0, 2)) + "</div>" +
            '<div class="cm"><b>' + esc(c.name) + "</b>" +
            "<small>已学 " + learned + " · 剩余 " + (courseSize(c) - learned) + " · 共 " + courseSize(c) + " 词</small></div>" +
            '<button class="btn btn-primary" data-action="course-open" data-id="' + c.id + '">打开</button>' +
            "</div></div>"
          );
        }).join("")
      : '<div class="card"><div class="empty">该学员还没有开通词库，请到「学员 → 课程开通」里添加</div></div>';
    return (
      pageHead("为 " + stu.name + " 选择词库",
        '<button class="btn btn-ghost" data-action="teach-exit">返回课表</button>') +
      '<div class="cards">' + cards + "</div>"
    );
  }

  /* ---------------- 词库页（已学/剩余 + 学新/复习） ---------------- */
  function viewCourse() {
    const c = courseById(currentCourseId);
    const stu = courseStudent();
    if (!c || !stu) return '<div class="card"><div class="empty">数据缺失，请返回</div></div>';
    const learned = learnedCount(stu.id, c.id);
    const remain = courseSize(c) - learned;
    const learnedWords = courseWords(c).filter((w) => learnedSet(stu.id, c.id)[w.w]);
    const rows = learnedWords.length
      ? learnedWords.map((w) => '<div class="word-row"><span class="en">' + esc(w.w) + "</span></div>").join("")
      : '<div class="empty">还没有学过的单词</div>';
    return (
      pageHead(c.name,
        '<button class="btn btn-ghost" data-action="teach-back">返回词库列表</button>') +
      '<div class="card"><div class="outcome" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="o brand"><b>' + courseSize(c) + "</b><span>总单词</span></div>" +
      '<div class="o ok"><b>' + learned + "</b><span>已掌握</span></div>" +
      '<div class="o bad"><b>' + remain + "</b><span>剩余</span></div></div>" +
      '<div style="display:flex;gap:10px;margin-top:14px">' +
      '<button class="btn btn-primary" style="flex:1;padding:14px;font-size:15px" data-action="start-new">学新</button>' +
      '<button class="btn btn-ghost" style="flex:1;padding:14px;font-size:15px" data-action="start-review-course"' + (learned ? "" : " disabled") + ">复习</button>" +
      "</div></div>" +
      '<div class="section-title">已掌握单词（' + learned + "）</div>" +
      '<div class="card">' + rows + "</div>"
    );
  }

  /* ================= 带背引擎 ================= */
  const STAGE_LABEL = { study: "单词识记", listen: "听音识义", cut: "剪纸盒", summary: "本组小结" };
  const WORD_CYCLE_KEY = "wn-word-cycle";

  function startNew(courseId, studentId, classId) {
    const c = courseById(courseId);
    const stu = courseStudent();
    const sid = studentId || (stu ? stu.id : null);
    const done = learnedSet(sid, courseId);
    const pool = courseWords(c).filter((w) => !done[w.w]);
    if (!pool.length) { toast("这个词库的单词已经全部学完啦"); return; }
    lesson = {
      courseId: courseId,
      studentId: sid,
      classId: classId || (pending ? pending.classId : null),
      mode: "new",
      phase: "pretest",
      all: pool,
      gridState: {}, marks: {}, gridIdx: 0,
      groups: [], blocks: [], bi: 0,
      stage: "", list: [], idx: 0, revealed: {},
      listenMark: {}, cutMark: {}, result: {},
    };
    route.name = "lesson";
    render();
  }
  function startReviewCourse(courseId, studentId) {
    const c = courseById(courseId);
    const cs = courseStudent();
    const sid = studentId || (cs ? cs.id : null);
    const ls = learnedSet(sid, courseId);
    const words = courseWords(c).filter((w) => ls[w.w]);
    if (!words.length) { toast("这个词库还没有已学单词"); return; }
    const chunks = groupsOf(words, 5);
    lesson = {
      courseId: courseId, studentId: sid, classId: null, mode: "review",
      phase: "run",
      all: courseWords(c), groups: chunks,
      blocks: [
        { kind: "cut", gi: 0, order: "shuffle" },
        { kind: "cut", gi: 0, order: "seq" },
        { kind: "summary", gi: 0, review: true },
      ],
      bi: 0, stage: "", list: [], idx: 0, revealed: {},
      listenMark: {}, cutMark: {}, result: {},
    };
    enterBlock();
  }

  const blockIdx = (b) => lesson.blocks.indexOf(b);
  function buildPlan(groupCount) {
    const blocks = [];
    for (let i = 0; i < groupCount; i++) {
      blocks.push({ kind: "study", gi: i });
      blocks.push({ kind: "listen", gi: i });
      blocks.push({ kind: "cut", gi: i, order: "shuffle" });
      blocks.push({ kind: "cut", gi: i, order: "seq" });
      blocks.push({ kind: "summary", gi: i });
    }
    return blocks;
  }
  function wordsOfBlock(b) {
    const idxs = b.mix ? b.mix : (b.groups ? b.groups : [b.gi]);
    let out = [];
    idxs.forEach((gi) => { out = out.concat(lesson.groups[gi] || []); });
    return out;
  }
  function groupsUpTo(gi) {
    let out = [];
    for (let i = 0; i <= gi; i++) out = out.concat(lesson.groups[i] || []);
    return out;
  }
  function enterBlock() {
    const b = lesson.blocks[lesson.bi];
    if (!b) { lesson.phase = "posttest"; lesson.gridIdx = 0; route.name = "lesson"; render(); return; }
    lesson.stage = b.kind;
    lesson.block = b;
    lesson.idx = 0;
    lesson.revealed = {};
    lesson.studyState = {};
    lesson.activeWord = null;
    lesson.listenOpt = null;
    lesson.picked = null;
    lesson.list = wordsOfBlock(b);
    if (b.kind === "cut" && b.order === "shuffle") lesson.list = shuffle(lesson.list);
    if (b.kind === "cut") lesson.cutMark = {};
    if (b.kind === "listen" && lesson.list.length) {
      lesson.listenOpt = makeOptions(lesson.list[0]);
      speak(lesson.list[0].w);
    }
    route.name = "lesson";
    render();
  }
  function blockTitle() {
    const b = lesson.block;
    if (b.kind === "summary") return "第 " + (b.gi + 1) + " 组小结";
    const label = (b.mix ? b.mix : [b.gi]).map((x) => x + 1).join("、");
    const t = b.kind === "study" ? "识记" : b.kind === "listen" ? "听音识义" : (b.order === "shuffle" ? "乱序剪纸盒" : "正序剪纸盒");
    return "第 " + label + " 组 · " + t + (b.mix ? "（混合复习）" : "");
  }

  /* ---- 学前/学后检测：只显示英文，点词=朗读/看中文/还原，右侧对·叉 ---- */
  function gridHtml(words) {
    const marks = lesson.marks;
    return '<div class="pre-list">' + words.map(function (w) {
      const st = lesson.gridState[w.w] || 0;
      const mk = marks[w.w];
      const cls = mk === true ? " ok" : mk === false ? " bad" : "";
      return (
        '<div class="pre-item' + cls + '">' +
        '<div class="pw" data-action="grid-word" data-w="' + esc(w.w) + '">' +
        '<b>' + esc(w.w) + "</b>" +
        (st >= 2 ? '<small>' + esc(w.m) + "</small>" : "") +
        "</div>" +
        '<div class="pm">' +
        '<button class="' + (mk === true ? "on" : "") + '" data-action="grid-ok" data-w="' + esc(w.w) + '" title="对">✅</button>' +
        '<button class="' + (mk === false ? "on" : "") + '" data-action="grid-no" data-w="' + esc(w.w) + '" title="叉">❌</button>' +
        "</div></div>"
      );
    }).join("") + "</div>";
  }
  function viewPretest() {
    const words = lesson.all;
    return (
      '<div class="section-title" style="margin-top:2px">学前检测 · ' + esc(courseName(lesson.courseId)) +
      '<span class="link" data-action="lesson-quit">退出</span></div>' +
      '<div class="card sticky-bar" style="display:flex;align-items:center;gap:12px">' +
      '<div id="gridMeta" style="flex:1;font-size:13.5px">' + gridMetaHtml() + "</div>" +
      '<div id="gridBtns" style="display:flex;gap:8px">' + gridBtnsHtml() + "</div></div>" +
      gridHtml(words, "pre")
    );
  }
  function markGrid(word, ok) {
    if (lesson.marks[word] === ok) delete lesson.marks[word];
    else lesson.marks[word] = ok;
    const row = gridRowOf(word);
    if (!row) { render(); return; }
    const val = lesson.marks[word];
    row.classList.toggle("ok", val === true);
    row.classList.toggle("bad", val === false);
    const okBtn = row.querySelector('[data-action="grid-ok"]');
    const noBtn = row.querySelector('[data-action="grid-no"]');
    if (okBtn) okBtn.classList.toggle("on", val === true);
    if (noBtn) noBtn.classList.toggle("on", val === false);
    refreshGridMeta();
  }
  function gridRowOf(word) {
    return $$(".pre-item").find(function (r) {
      const p = r.querySelector(".pw");
      return p && p.dataset.w === word;
    });
  }
  function refreshGridMeta() {
    const meta = document.getElementById("gridMeta");
    const box = document.getElementById("gridBtns");
    if (meta) meta.innerHTML = gridMetaHtml();
    if (box) box.innerHTML = gridBtnsHtml();
  }
  function gridWords() {
    return lesson.phase === "posttest" ? (lesson.postWords || lesson.runWords || []) : (lesson.all || []);
  }
  function gridMetaHtml() {
    const words = gridWords();
    const marked = words.filter((w) => lesson.marks[w.w] !== undefined).length;
    const wrong = words.filter((w) => lesson.marks[w.w] === false).length;
    return '已标记 <b style="color:var(--brand)">' + marked + "</b> / " + words.length +
      ' &nbsp;·&nbsp; 打叉 <b style="color:var(--bad)">' + wrong + "</b> 个";
  }
  function gridBtnsHtml() {
    const words = gridWords();
    const marked = words.filter((w) => lesson.marks[w.w] !== undefined).length;
    const wrong = words.filter((w) => lesson.marks[w.w] === false).length;
    if (lesson.phase === "anti") {
      return '<button class="btn btn-ghost" data-action="anti-quit">返回</button>' +
        '<button class="btn btn-primary" data-action="anti-submit"' +
        (marked === words.length ? "" : " disabled") + ">提交</button>";
    }
    if (lesson.phase === "posttest") {
      return '<button class="btn btn-primary" data-action="posttest-submit"' +
        (marked === words.length ? "" : " disabled") + ">提交学后检测</button>";
    }
    const allKnown = words.length > 0 && marked === words.length && wrong === 0;
    if (allKnown) {
      return '<button class="btn btn-ghost" data-action="switch-course">切换词库</button>' +
        '<button class="btn btn-primary" data-action="pretest-done">完成</button>';
    }
    return '<button class="btn btn-primary" data-action="pretest-submit"' + (wrong ? "" : " disabled") + ">提交，开始学习</button>";
  }
  function cycleGridWord(word) {
    lesson.gridState[word] = ((lesson.gridState[word] || 0) + 1) % 3;
    const item = (lesson.all || []).find((x) => x.w === word);
    if (lesson.gridState[word] === 1 && item) speak(item.w);
    const row = gridRowOf(word);
    if (!row) { render(); return; }
    const pw = row.querySelector(".pw");
    const small = pw.querySelector("small");
    if (lesson.gridState[word] >= 2) {
      if (small) small.textContent = item ? item.m : "";
      else if (item) pw.insertAdjacentHTML("beforeend", "<small>" + esc(item.m) + "</small>");
    } else if (small) {
      small.remove();
    }
  }
  function findByW(sel, word) {
    return $$(sel).find((el) => el.dataset.w === word);
  }
  function cycleStudyWord(word) {
    lesson.activeWord = word;
    lesson.studyState[word] = ((lesson.studyState[word] || 0) + 1) % 3;
    const st = lesson.studyState[word];
    const item = lesson.list.find((x) => x.w === word);
    if (st === 1 && item) speak(item.w);
    $$(".study-tile").forEach((el) => el.classList.toggle("is-active", el.dataset.w === word));
    const tile = findByW(".study-tile", word);
    if (!tile) { render(); return; }
    tile.classList.toggle("on", st >= 2);
    const side = tile.querySelector(".st-side");
    if (side) {
      side.innerHTML = st >= 2
        ? '<div class="st-cn">' + esc(item ? item.m : "") + "</div>"
        : "";
    }
  }
  function submitPretest() {
    const wrongWords = lesson.all.filter((w) => lesson.marks[w.w] === false).slice(0, 30);
    if (!wrongWords.length) { toast("没有打叉的单词"); return; }
    saveKnownMarks();
    lesson.groups = groupsOf(wrongWords, 5);
    lesson.blocks = buildPlan(lesson.groups.length);
    lesson.runWords = wrongWords;
    lesson.phase = "run";
    lesson.bi = 0;
    toast("共 " + wrongWords.length + " 个单词，分 " + lesson.groups.length + " 组");
    enterBlock();
  }
  function saveKnownMarks() {
    if (lesson.mode === "review" || !lesson.courseId) return;
    const prog = courseProgress(lesson.studentId, lesson.courseId);
    const kset = {};
    (prog.known || []).forEach((w) => { kset[w] = 1; });
    (lesson.all || []).forEach((w) => { if (lesson.marks[w.w] === true) kset[w.w] = 1; });
    prog.known = Object.keys(kset);
    S.progress[progKey(lesson.studentId, lesson.courseId)] = prog;
    saveState();
  }
  function switchCourse() {
    saveKnownMarks();
    lesson = null;
    route.name = "teach";
    render();
    toast("已切换词库");
  }
  function confirmAllKnown() {
    openModal(
      '<div class="modal-head">温馨提示 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body"><p style="font-size:14px;margin:0">这个词库剩下的单词学生都认识了，是否完成并下课？</p></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">继续看看</button>' +
      '<button class="btn btn-primary" data-action="do-finish-all">确认完成</button></div>'
    );
  }
  function finishAllKnown() {
    saveKnownMarks();
    const stu = studentById(lesson.studentId);
    const cls = S.classes.find((x) => x.id === lesson.classId);
    const type = typeByKey(cls ? cls.type : "60");
    const words = lesson.all || [];
    if (lesson.classId) {
      const rec = {
        id: uid(), date: todayKey(), studentId: lesson.studentId,
        student: stu ? stu.name : "学员", course: courseName(lesson.courseId), courseId: lesson.courseId,
        type: type.label, subject: "单词带背",
        coach: (cls && cls.coach) || (S.user && S.user.name) || "Diana",
        correct: words.length, total: words.length,
        words: words.map((w) => ({ w: w.w, ph: w.ph, m: w.m })),
        minutes: type.min,
      };
      S.records.unshift(rec);
      if (cls) cls.status = "已完成";
      if (stu && type.key === "60") stu.hours = Math.max(0, (stu.hours || 0) - 1);
      createAntiReviews(rec);
      saveState();
    }
    lesson = null;
    route.name = "schedule";
    render();
    toast("学生已全部认识，已完成下课");
  }

  /* ---- 识记 ---- */
  function viewStudy() {
    const cards = lesson.list.map(function (w) {
      const st = lesson.studyState[w.w] || 0;
      return (
        '<div class="study-tile' + (st >= 2 ? " on" : "") + (lesson.activeWord === w.w ? " is-active" : "") +
        '" data-action="study-word" data-w="' + esc(w.w) + '">' +
        '<div class="st-word"><span class="st-en">' + esc(w.w) + '</span><span class="st-ph">' + esc(w.ph) + "</span></div>" +
        '<div class="st-side">' +
        (st >= 2 ? '<div class="st-cn">' + esc(w.m) + "</div>" : "") +
        "</div>" +
        "</div>"
      );
    }).join("");
    return (
      '<div class="card"><div class="quiz-top"><span>' + blockTitle() + "</span>" +
      '<span class="stop" data-action="lesson-quit">退出</span></div>' +
      '<div class="study-tiles">' + cards + "</div>" +
      '<button class="btn btn-primary btn-block" style="margin-top:14px" data-action="block-next">下一步：听音识义</button>' +
      "</div>"
    );
  }
  /* ---- 听音识义 ---- */
  function viewListen() {
    const w = lesson.list[lesson.idx];
    const opts = lesson.listenOpt.map((m) =>
      '<button class="option" data-action="listen-answer" data-value="' + esc(m) + '">' + esc(m) + "</button>").join("");
    return (
      '<div class="card"><div class="quiz-top"><span>' + blockTitle() + " · " + (lesson.idx + 1) + "/" + lesson.list.length + "</span>" +
      '<span class="stop" data-action="lesson-quit">退出</span></div>' +
      '<div class="timer-bar"><i style="width:' + (lesson.idx / lesson.list.length) * 100 + '%"></i></div>' +
      '<div class="study-card"><div class="big-word">🔊</div>' +
      '<div class="chips"><button class="chip2" data-action="listen-play">再听一遍</button></div></div>' +
      '<div class="options">' + opts + "</div>" +
      '<div class="feedback" id="qFeedback"></div></div>'
    );
  }
  function answerListen(picked) {
    const w = lesson.list[lesson.idx];
    const ok = picked === w.m;
    lesson.listenMark[w.w] = ok;
    $$(".option").forEach(function (btn) {
      btn.disabled = true;
      if (btn.dataset.value === w.m) btn.classList.add("is-correct");
      else if (btn.dataset.value === picked) btn.classList.add("is-wrong");
    });
    const fb = document.getElementById("qFeedback");
    if (fb) { fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = ok ? "答对了 ✓" : "正确答案：" + w.m; }
    speak(w.w);
    setTimeout(function () {
      if (!lesson) return;
      lesson.idx++;
      if (lesson.idx >= lesson.list.length) { blockDone(); return; }
      lesson.listenOpt = makeOptions(lesson.list[lesson.idx]);
      lesson.picked = null;
      render();
      speak(lesson.list[lesson.idx].w);
    }, ok ? 800 : 1200);
  }
  /* ---- 剪纸盒 ---- */
  function viewCut() {
    const rows = lesson.list.map(function (w) {
      const on = lesson.revealed[w.w];
      const mk = lesson.cutMark[w.w];
      const cls = mk === true ? " cut-ok" : mk === false ? " cut-bad" : "";
      return (
        '<div class="pre-item' + cls + '">' +
        '<div class="pw" data-action="cut-reveal" data-w="' + esc(w.w) + '">' +
        "<b>" + esc(w.w) + '</b><span class="ph2">' + esc(w.ph) + "</span>" +
        (on ? "<small>" + esc(w.m) + "</small>" : "") +
        "</div>" +
        '<div class="pm">' +
        '<button class="' + (mk === true ? "on" : "") + '" data-action="cut-ok" data-w="' + esc(w.w) + '" title="对">✅</button>' +
        '<button class="' + (mk === false ? "on" : "") + '" data-action="cut-no" data-w="' + esc(w.w) + '" title="叉">❌</button>' +
        "</div></div>"
      );
    }).join("");
    return (
      '<div class="section-title" style="margin-top:2px">' + blockTitle() +
      '<span class="link" data-action="lesson-quit">退出</span></div>' +
      '<div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
      '<div id="cutMeta" style="flex:1;font-size:13.5px">' + cutMetaHtml() + "</div>" +
      '<button id="cutNext" class="btn btn-primary" data-action="block-next"' +
      (lesson.list.every((w) => lesson.cutMark[w.w] !== undefined) ? "" : " disabled") + ">完成本组</button></div>" +
      '<div class="pre-list">' + rows + "</div>"
    );
  }
  function cutMetaHtml() {
    const n = lesson.list.length;
    const marked = lesson.list.filter((w) => lesson.cutMark[w.w] !== undefined).length;
    const okN = lesson.list.filter((w) => lesson.cutMark[w.w] === true).length;
    const badN = lesson.list.filter((w) => lesson.cutMark[w.w] === false).length;
    return '已标记 <b style="color:var(--brand)">' + marked + "</b> / " + n +
      ' &nbsp;·&nbsp; ✅ <b style="color:var(--ok)">' + okN + '</b> &nbsp; ❌ <b style="color:var(--bad)">' + badN + "</b>";
  }
  function refreshCutMeta() {
    const meta = document.getElementById("cutMeta");
    const btn = document.getElementById("cutNext");
    if (meta) meta.innerHTML = cutMetaHtml();
    if (btn) btn.disabled = !lesson.list.every((w) => lesson.cutMark[w.w] !== undefined);
  }
  function markCut(word, ok) {
    lesson.cutMark[word] = ok;
    const row = gridRowOf(word);
    if (!row) { render(); return; }
    row.classList.toggle("cut-ok", ok === true);
    row.classList.toggle("cut-bad", ok === false);
    const b1 = row.querySelector('[data-action="cut-ok"]');
    const b2 = row.querySelector('[data-action="cut-no"]');
    if (b1) b1.classList.toggle("on", ok === true);
    if (b2) b2.classList.toggle("on", ok === false);
    refreshCutMeta();
  }
  function cycleCutWord(word) {
    lesson.revealed[word] = !lesson.revealed[word];
    const item = lesson.list.find((x) => x.w === word);
    if (lesson.revealed[word] && item) speak(item.w);
    const row = gridRowOf(word);
    if (!row) { render(); return; }
    const pw = row.querySelector(".pw");
    const small = pw.querySelector("small");
    if (lesson.revealed[word]) {
      if (small) small.textContent = item ? item.m : "";
      else if (item) pw.insertAdjacentHTML("beforeend", "<small>" + esc(item.m) + "</small>");
    } else if (small) {
      small.remove();
    }
  }
  function blockDone() {
    lesson.bi++;
    if (lesson.bi >= lesson.blocks.length) {
      if (lesson.mode === "review") { lesson.phase = "end"; render(); return; }
      lesson.postWords = groupsUpTo(lesson.groups.length - 1);
      lesson.phase = "posttest"; lesson.marks = {}; lesson.gridState = {}; render(); return;
    }
    enterBlock();
  }
  /* ---- 小结 ---- */
  function viewSummary() {
    const b = lesson.block;
    const isMixSummary = !!b.mix;
    const g = isMixSummary
      ? b.mix.reduce((a, gi) => a.concat(lesson.groups[gi] || []), [])
      : (lesson.groups[b.gi] || []);
    const okCount = g.filter((w) => lesson.cutMark[w.w] === true).length;
    const badCount = g.filter((w) => lesson.cutMark[w.w] === false).length;
    const rows = g.map((w) =>
      '<div class="word-row"><span class="en">' + esc(w.w) + '</span><span class="cn">' + esc(w.m) + "</span></div>").join("");
    const isLast = lesson.bi === lesson.blocks.length - 1;
    const hasMix = !!MIX_AFTER[b.gi];
    const title = isMixSummary
      ? "第 " + b.mix.map((x) => x + 1).join("、") + " 组 · 混合复习小结"
      : blockTitle();
    return (
      '<div class="card"><div class="result-hero">' +
      '<div style="font-size:17px;font-weight:800">' + (lesson.mode === "review" ? "复习小结" : title) + " 完成！</div>" +
      '<div style="color:var(--muted);font-size:12.5px;margin-top:6px">本组 ' + g.length + " 个单词</div></div>" +
      '<div class="outcome"><div class="o ok"><b>' + okCount + "</b><span>剪纸盒答对</span></div>" +
      '<div class="o bad"><b>' + badCount + "</b><span>剪纸盒答错</span></div></div></div>" +
      '<div class="card"><div class="section-title" style="margin-top:0">本组单词（' + g.length + "）</div>" + rows + "</div>" +
      '<div style="display:flex;gap:10px;margin-top:12px">' +
      (lesson.mode === "review"
        ? '<button class="btn btn-primary" style="flex:1;padding:13px" data-action="lesson-quit">完成复习</button>'
        : (isMixSummary ? "" : '<button class="btn btn-ghost" style="flex:1;padding:13px" data-action="summary-redo">重新学习</button>') +
          (hasMix && !isMixSummary
            ? '<button class="btn btn-ghost" style="flex:1;padding:13px" data-action="summary-mix">混合混组</button>'
            : (isLast ? "" : '<button class="btn btn-ghost" style="flex:1;padding:13px" data-action="summary-next">下一组</button>')) +
          '<button class="btn btn-primary" style="flex:1;padding:13px" data-action="summary-post">学后检测</button>') +
      "</div>"
    );
  }
  /* ---- 学后检测 ---- */
  function viewPosttest() {
    const words = lesson.postWords || lesson.runWords || [];
    return (
      '<div class="section-title" style="margin-top:2px">学后检测 · 本课所学 ' + words.length + " 个单词</div>" +
      '<div class="card sticky-bar" style="display:flex;align-items:center;gap:12px">' +
      '<div id="gridMeta" style="flex:1;font-size:13.5px">' + gridMetaHtml() + "</div>" +
      '<div id="gridBtns" style="display:flex;gap:8px">' + gridBtnsHtml() + "</div></div>" +
      gridHtml(words, "post")
    );
  }
  function submitPosttest() {
    const words = lesson.postWords || lesson.runWords || [];
    const wrong = words.filter((w) => lesson.marks[w.w] === false);
    lesson.postWrong = wrong;
    lesson.phase = "end";
    render();
  }
  /* ---- 结束页 ---- */
  function viewEnd() {
    const words = lesson.postWords || lesson.runWords || [];
    const wrong = lesson.postWrong || [];
    const ok = words.length - wrong.length;
    if (lesson.mode === "review") {
      return (
        '<div class="card"><div class="result-hero"><div style="font-size:17px;font-weight:800">复习完成！</div></div>' +
        '<div class="outcome"><div class="o ok"><b>' + Object.values(lesson.cutMark).filter((v) => v === true).length +
        '</b><span>答对</span></div><div class="o bad"><b>' + Object.values(lesson.cutMark).filter((v) => v === false).length +
        '</b><span>答错</span></div></div></div>' +
        '<div style="margin-top:12px"><button class="btn btn-primary btn-block" style="padding:14px" data-action="lesson-quit">返回词库</button></div>'
      );
    }
    const rows = wrong.length
      ? wrong.map((w) => '<div class="word-row"><span class="en">' + esc(w.w) + '</span><span class="cn">' + esc(w.m) + "</span></div>").join("")
      : '<div class="empty">全部答对，太棒了 🎉</div>';
    return (
      '<div class="card"><div class="result-hero">' +
      '<div style="font-size:17px;font-weight:800">学后检测结果</div>' +
      '<div style="color:var(--muted);font-size:12.5px;margin-top:6px">' + esc(courseName(lesson.courseId)) + " · 共 " + words.length + " 个单词</div></div>" +
      '<div class="outcome" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="o ok"><b>' + ok + "</b><span>掌握</span></div>" +
      '<div class="o bad"><b>' + wrong.length + "</b><span>需加强</span></div>" +
      '<div class="o brand"><b>' + (words.length ? Math.round((ok / words.length) * 100) : 0) + "%</b><span>正确率</span></div></div></div>" +
      '<div class="card"><div class="section-title" style="margin-top:0">需加强的单词（' + wrong.length + "）</div>" + rows + "</div>" +
      '<div style="display:flex;gap:10px;margin-top:12px">' +
      '<button class="btn btn-ghost" style="flex:1;padding:13px" data-action="result-continue">继续学习</button>' +
      '<button class="btn btn-primary" style="flex:1;padding:13px" data-action="result-finish">创建抗遗忘并下课</button></div>'
    );
  }

  function viewLesson() {
    if (lesson.phase === "pretest") return viewPretest();
    if (lesson.phase === "posttest") return viewPosttest();
    if (lesson.phase === "end") return viewEnd();
    if (lesson.stage === "study") return viewStudy();
    if (lesson.stage === "listen") return viewListen();
    if (lesson.stage === "cut") return viewCut();
    if (lesson.stage === "summary") return viewSummary();
    return '<div class="card"><div class="empty">准备中…</div></div>';
  }

  /* ---- 结算 ---- */
  function persistRound() {
    const words = lesson.postWords || lesson.runWords || [];
    const wrong = lesson.postWrong || [];
    const prog = courseProgress(lesson.studentId, lesson.courseId);
    const set = {};
    (prog.learned || []).forEach((w) => { set[w] = 1; });
    words.forEach((w) => { set[w.w] = 1; });
    prog.learned = Object.keys(set);
    const wset = {};
    (prog.wrong || []).forEach((w) => { wset[w] = 1; });
    wrong.forEach((w) => { wset[w.w] = 1; });
    prog.wrong = Object.keys(wset);
    S.progress[progKey(lesson.studentId, lesson.courseId)] = prog;
    saveState();
  }
  function newPoolWords(studentId, courseId) {
    const done = learnedSet(studentId, courseId);
    return courseWords(courseById(courseId)).filter((w) => !done[w.w]);
  }
  function finishWithAnti() {
    const words = lesson.postWords || lesson.runWords || [];
    const wrong = lesson.postWrong || [];
    wrong.forEach(function (w) {
      if (!S.wrong.some((x) => x.w === w.w)) S.wrong.push({ w: w.w, ph: w.ph, m: w.m, ex: w.ex });
    });
    const stu = studentById(lesson.studentId);
    const cls = S.classes.find((x) => x.id === lesson.classId);
    const type = typeByKey(cls ? cls.type : "60");
    persistRound();
    if (lesson.classId) {
      const rec = {
        id: uid(), date: todayKey(), studentId: lesson.studentId,
        student: stu ? stu.name : "学员", course: courseName(lesson.courseId), courseId: lesson.courseId,
        type: type.label, subject: "单词带背",
        coach: (cls && cls.coach) || (S.user && S.user.name) || "Diana",
        correct: words.length - wrong.length, total: words.length,
        words: words.map((w) => ({ w: w.w, ph: w.ph, m: w.m })),
        minutes: type.min,
      };
      S.records.unshift(rec);
      if (cls) cls.status = "已完成";
      if (stu && type.key === "60") stu.hours = Math.max(0, (stu.hours || 0) - 1);
      createAntiReviews(rec);
    }
    saveState();
    lesson = null;
    route.name = "schedule";
    render();
    toast("已创建抗遗忘并下课");
  }

  /* ---------------- 学员 ---------------- */
  function pageHead(title, actions) {
    return (
      '<div class="page-head"><div class="ph-main"><h1>' + esc(title) + "</h1></div>" +
      (actions ? '<div class="ph-actions">' + actions + "</div>" : "") + "</div>"
    );
  }
  function viewDashboard() {
    const ICON = {
      users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16.5 5.4a3.4 3.4 0 0 1 0 6.6M17.6 20a6.3 6.3 0 0 0-1.6-4.2"/></svg>',
      coach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>',
      book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"/><path d="M9 4h4.5A1.5 1.5 0 0 1 15 5.5v13A1.5 1.5 0 0 1 13.5 20H9"/><path d="M17.5 6.2l2.6.7a1.5 1.5 0 0 1 1 1.8l-3.4 12"/></svg>',
    };
    const coachCount = (S.coaches || []).length;
    const today = todayKey();
    const pendingCount = S.classes.filter((c) => c.date === today && c.status !== "已完成").length;
    const hours = S.students.reduce((a, s) => a + (s.hours || 0), 0);
    const totalWords = S.courses.reduce((a, c) => a + courseSize(c), 0);
    const kpis = [
      { label: "总学员", value: S.students.length, unit: "人", sub: "在读学员", nav: "students", icon: ICON.users },
      { label: "教练", value: coachCount, unit: "人", sub: "机构教练", nav: null, icon: ICON.coach },
      { label: "授权课程", value: S.courses.length, unit: "门", sub: "可用词库", nav: "library", icon: ICON.book },
    ];
    const classes = S.classes.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const rows = classes.length
      ? classes.map(function (c, i) {
          const stu = studentById(c.studentId);
          const type = typeByKey(c.type);
          const hh = c.time.split(":");
          const end = new Date();
          end.setHours(+hh[0], (+hh[1]) + type.min, 0, 0);
          const endStr = pad2(end.getHours()) + ":" + pad2(end.getMinutes());
          const coach = c.coach || (S.user && S.user.name) || "Diana";
          const badge = statusBadge(c.status);
          return (
            '<div class="tbl-row">' +
            '<div class="c-idx">' + (i + 1) + "</div>" +
            "<div>" + esc(c.date) + "</div>" +
            '<div class="c-stu"><span class="avatar">' + (stu ? esc(stu.name.slice(0, 1)) : "?") + "</span>" +
            (stu ? esc(stu.name) : "未知学员") + "</div>" +
            '<div class="c-time">' + esc(c.time) + " – " + endStr + ' <span class="tag">' + type.label + "</span></div>" +
            '<div class="c-coach"><span class="avatar">' + esc(coach.slice(0, 1)) + "</span>" + esc(coach) + " " + badge + "</div>" +
            '<div class="c-ops">' +
            (c.status === "已完成" ? "" : '<button class="btn" data-action="edit-class" data-id="' + c.id + '">编辑</button>') +
            '<button class="btn btn-ghost" data-action="del-class" data-id="' + c.id + '">删除</button>' +
            "</div></div>"
          );
        }).join("")
      : '<div class="empty">还没有排课，点右上角「＋ 新增排课」开始</div>';
    return (
      pageHead("控制台", '<button class="btn btn-primary" data-action="open-schedule">＋ 新增排课</button>') +
      '<div class="kpi-row">' +
      kpis.map(function (k) {
        return '<div class="kpi"' + (k.nav ? ' data-action="nav-to" data-goto="' + k.nav + '"' : "") + ">" +
          '<div class="kpi-head"><span class="kpi-label">' + k.label + "</span>" +
          '<span class="kpi-ico">' + k.icon + "</span></div>" +
          '<div class="kpi-value">' + k.value + "<small>" + k.unit + "</small></div>" +
          '<div class="kpi-sub">' + k.sub + "</div></div>";
      }).join("") +
      "</div>" +
      '<div class="mini-stats">' +
      '<span>今日待上课 <b>' + pendingCount + "</b> 节</span>" +
      '<span>全机构剩余课时 <b>' + hours + "</b> 节</span>" +
      '<span>词库总词数 <b>' + totalWords.toLocaleString() + "</b> 词</span>" +
      "</div>" +
      '<div class="section-title">排课管理 · 共 ' + classes.length + ' 节</div>' +
      '<div class="tbl">' +
      '<div class="tbl-head"><div>序号</div><div>日期</div><div>学员</div><div>时段</div><div>教练</div><div>操作</div></div>' +
      '<div class="tbl-body">' + rows + "</div></div>"
    );
  }

  /* ---------------- 学员 ---------------- */
  function viewLibrary() {
    const cards = S.courses.map(function (c) {
      const n = courseSize(c);
      const opened = S.students.filter((s) => (s.courses || []).indexOf(c.id) >= 0).length;
      return (
        '<div class="card"><div class="course-card">' +
        '<div class="ci">' + esc(c.name.slice(0, 2)) + "</div>" +
        '<div class="cm"><b>' + esc(c.name) + "</b>" +
        "<small>共 " + n + " 个单词 · " + opened + " 名学员已开通" +
        (c.createdAt ? " · " + c.createdAt : "") + "</small></div>" +
        '<div style="display:flex;gap:6px;flex:none">' +
        '<button class="btn" data-action="lib-view" data-id="' + c.id + '">查看</button>' +
        '<button class="btn btn-ghost" data-action="lib-remove" data-id="' + c.id + '">删除</button>' +
        "</div></div></div>"
      );
    }).join("");
    return (
      pageHead("词库信息",
        '<button class="btn btn-primary" data-action="lib-new">＋ 创建词库</button>') +
      '<div class="section-title" style="margin-top:0">全部词库 · 共 ' + S.courses.length + " 个</div>" +
      '<div class="card" style="margin-bottom:12px"><div style="font-size:13px;color:var(--muted);line-height:1.9">' +
      "「创建词库」= 上传或粘贴单词表。每行一个单词，支持：<br>" +
      "<b>英文,音标,中文</b>（如 <code>room,/ruːm/,房间</code>）· <b>英文,中文</b> · 只写 <b>英文</b>；" +
      "分隔符可用逗号 / 制表符 / 中文逗号。</div></div>" +
      (S.courses.length
        ? '<div class="cards">' + cards + "</div>"
        : '<div class="card"><div class="empty">还没有词库，点右上角「＋ 创建词库」上传</div></div>')
    );
  }
  function openCreateCourse() {
    openModal(
      '<div class="modal-head">创建词库 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>词库名称 *</label><input id="cName" placeholder="如：人教版 · 必修一 Unit 3" /></div>' +
      '<div class="field"><label>上传文件（.csv / .txt，UTF-8）</label><input id="cFile" type="file" accept=".csv,.txt,text/plain,text/csv" /></div>' +
      '<div class="field"><label>或直接粘贴单词（每行一个）</label>' +
      '<textarea id="cText" class="input" rows="7" placeholder="room,/ruːm/,房间&#10;anxious,/ˈæŋkʃəs/,焦虑的&#10;admit,承认&#10;burden"></textarea></div>' +
      '<div id="cPreview" style="font-size:12.5px;color:var(--muted);line-height:1.7">还没有识别到单词</div>' +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-action="lib-save">创建词库</button></div>'
    );
    const f = document.getElementById("cFile");
    if (f) {
      f.addEventListener("change", function () {
        const file = f.files && f.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = function () {
          const ta = document.getElementById("cText");
          if (ta) ta.value = String(r.result || "");
          updateCoursePreview();
        };
        r.readAsText(file, "utf-8");
      });
    }
    const ta = document.getElementById("cText");
    if (ta) ta.addEventListener("input", updateCoursePreview);
  }
  function updateCoursePreview() {
    const ta = document.getElementById("cText");
    const words = parseWords(ta ? ta.value : "");
    const el = document.getElementById("cPreview");
    if (!el) return;
    el.innerHTML = words.length
      ? "已识别 <b style=\"color:var(--brand)\">" + words.length + "</b> 个单词，示例：" +
        words.slice(0, 3).map((w) => esc(w.w + (w.ph ? " " + w.ph : "") + (w.m ? " " + w.m : ""))).join("、")
      : "还没有识别到单词";
  }
  function saveCourse() {
    const name = ($("#cName") || {}).value ? $("#cName").value.trim() : "";
    if (!name) { toast("请填写词库名称"); return; }
    const ta = document.getElementById("cText");
    const words = parseWords(ta ? ta.value : "");
    if (!words.length) { toast("请上传文件或粘贴单词"); return; }
    S.courses.push({ id: "u" + uid(), name: name, words: words, createdAt: todayKey() });
    saveState();
    closeModal();
    route.name = "library";
    render();
    toast("已创建词库：" + name + "（" + words.length + " 个单词）");
  }
  function openCourseWords(id) {
    const c = courseById(id);
    if (!c) return;
    const words = courseWords(c);
    openModal(
      '<div class="modal-head">' + esc(c.name) + "（" + words.length + '） <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      (words.length
        ? words.map((w) => '<div class="word-row"><span class="en">' + esc(w.w) + '</span><span class="cn">' +
            esc((w.ph ? w.ph + "  " : "") + (w.m || "")) + "</span></div>").join("")
        : '<div class="empty">这个词库还没有单词</div>') +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>'
    );
  }
  function removeCourse(id) {
    const c = courseById(id);
    if (!c) return;
    const used = S.students.filter((s) => (s.courses || []).indexOf(id) >= 0).length;
    if (!confirm("确定删除词库「" + c.name + "」吗？" + (used ? "有 " + used + " 名学员已开通，会一并取消。" : ""))) return;
    S.courses = S.courses.filter((x) => x.id !== id);
    S.students.forEach((s) => { s.courses = (s.courses || []).filter((x) => x !== id); });
    saveState();
    render();
    toast("已删除词库");
  }

  /* ---------------- 学员 ---------------- */
  function studentRow(s) {
    const opened = (s.courses || []).length;
    const meta = "剩余课时 " + (s.hours || 0) + " 节 · 已开通 " + opened + " 个词库" +
      (s.grade ? " · " + esc(s.grade) : "") + (s.phone ? " · " + esc(s.phone) : "");
    return (
      '<div class="mgmt-row">' +
      '<div class="mgmt-info"><span class="avatar">' + esc(s.name.slice(0, 1)) + "</span>" +
      '<div class="mi-main"><b>' + esc(s.name) + "</b><small>" + meta + "</small></div>" +
      (s.status === "禁用" ? '<span class="badge live">已禁用</span>' : '<span class="badge done">正常</span>') +
      "</div>" +
      '<div class="mgmt-ops">' +
      '<button class="btn" data-action="stu-view" data-id="' + s.id + '">查看</button>' +
      (isAdmin()
        ? '<button class="btn" data-action="stu-edit" data-id="' + s.id + '">编辑</button>' +
          '<button class="btn" data-action="stu-recharge" data-id="' + s.id + '">充值</button>' +
          '<button class="btn" data-action="stu-course" data-id="' + s.id + '">课程开通</button>' +
          '<button class="btn btn-ghost" data-action="stu-more" data-id="' + s.id + '">更多</button>' +
          (s.status === "禁用"
            ? '<button class="btn" style="color:var(--bad);background:var(--bad-soft)" data-action="stu-del" data-id="' + s.id + '">删除</button>'
            : "")
        : "") +
      "</div></div>"
    );
  }
  const filterStudents = (kw) => visibleStudents().filter((s) => !kw || s.name.indexOf(kw) >= 0 || (s.phone || "").indexOf(kw) >= 0);
  const stuListHtml = (list) => (list.length ? list.map(studentRow).join("") : '<div class="empty">没有匹配的学员</div>');
  function viewStudents() {
    const list = visibleStudents();
    return (
      pageHead("学员管理",
        isAdmin() ? '<button class="btn btn-primary" data-action="stu-new">＋ 新增学员</button>' : "") +
      '<div class="section-title" style="margin-top:0">' + (isAdmin() ? "教授学员" : "我的学员") + " · 共 " + list.length + " 人</div>" +
      '<div class="card" style="margin-bottom:12px"><input id="stuSearch" class="input" placeholder="搜索学员姓名或手机号" value="' + esc(stuSearch) + '" /></div>' +
      '<div class="card mgmt-list" id="stuList">' + stuListHtml(filterStudents(stuSearch)) + "</div>"
    );
  }
  function viewStudentDetail() {
    const s = studentById(currentStudentId);
    if (!s) return '<div class="card"><div class="empty">学员不存在</div></div>';
    if (!canViewStudent(s.id)) return '<div class="card"><div class="empty">无权查看该学员</div></div>';
    const opened = (s.courses || []).map(courseById).filter(Boolean);
    const recs = visibleRecords().filter((r) => r.studentId === s.id || r.student === s.name);
    const recRows = recs.length
      ? recs.map(function (r) {
          const rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
          return '<div class="list-item"><div class="li-main"><b>' + esc(r.course || r.subject) + "</b><small>" + r.date +
            " · " + esc(r.type) + " · " + r.correct + "/" + r.total + " 题 · 正确率 " + rate + '%</small></div><span class="li-h">' +
            (r.minutes || 0) + "′</span></div>";
        }).join("")
      : '<div class="empty">暂无上课记录</div>';
    return (
      pageHead(s.name,
        (isAdmin() ? '<button class="btn" data-action="stu-edit" data-id="' + s.id + '">编辑</button>' : "") +
        '<button class="btn btn-ghost" data-action="stu-back">返回列表</button>') +
      '<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(420px,1fr))">' +
      '<div class="card"><div class="section-title" style="margin-top:0">基本信息</div>' +
      '<div class="kv"><span class="k">姓名</span><span class="v">' + esc(s.name) + "</span></div>" +
      '<div class="kv"><span class="k">手机号</span><span class="v">' + dash(s.phone) + "</span></div>" +
      '<div class="kv"><span class="k">年级</span><span class="v">' + dash(s.grade) + "</span></div>" +
      '<div class="kv"><span class="k">学校</span><span class="v">' + dash(s.school) + "</span></div>" +
      '<div class="kv"><span class="k">剩余课时</span><span class="v"><b style="color:var(--brand)">' + (s.hours || 0) + "</b> 节（60分钟）</span></div>" +
      '<div class="kv"><span class="k">账号状态</span><span class="v">' + (s.status === "禁用" ? "已禁用" : "正常") + "</span></div>" +
      '<div class="kv"><span class="k">加入时间</span><span class="v">' + dash(s.joinedAt) + "</span></div>" +
      (isAdmin() ? '<div class="kv"><span class="k">家长登录密码</span><span class="v">' + esc(s.pass || "123456") + "</span></div>" : "") +
      '<div class="kv"><span class="k">备注</span><span class="v">' + dash(s.remark) + "</span></div></div>" +
      '<div class="card"><div class="section-title" style="margin-top:0">已开通课程（' + opened.length + "）</div>" +
      (opened.length ? opened.map(function (c) {
        const l = learnedCount(s.id, c.id);
        const pct = courseSize(c) ? Math.round((l / courseSize(c)) * 100) : 0;
        return '<div class="word-row"><span class="en" style="min-width:150px">' + esc(c.name) + '</span><span class="cn">' +
          l + " / " + courseSize(c) + " 词 · " + pct + "%</span></div>";
      }).join("") : '<div class="empty">还没有开通词库</div>') + "</div></div>" +
      '<div class="section-title">上课记录（' + recs.length + '）<span class="link" data-action="stu-export" data-id="' + s.id + '">导出 CSV</span></div>' +
      '<div class="card">' + recRows + "</div>"
    );
  }

  /* ---------------- 教练管理 ---------------- */
  function viewCoaches() {
    const list = S.coaches || [];
    const cards = list.map(function (c) {
      const cnt = S.classes.filter((x) => (x.coach || "Diana") === c.name).length;
      return (
        '<div class="mgmt-row">' +
        '<div class="mgmt-info"><span class="avatar">' + esc(c.name.slice(0, 1)) + "</span>" +
        '<div class="mi-main"><b>' + esc(c.name) + "</b><small>登录账号 " + esc(c.name) + " · 名下排课 " + cnt + " 节" +
        (c.joinedAt ? " · " + c.joinedAt : "") + "</small></div>" +
        ((!c.role || c.role === "admin")
          ? '<span class="badge done">管理员</span>'
          : '<span class="badge wait">教练</span>') +
        (S.user && S.user.name === c.name ? '<span class="badge done">当前登录</span>' : "") + "</div>" +
        '<div class="mgmt-ops">' +
        '<button class="btn" data-action="coach-edit" data-id="' + esc(c.name) + '">编辑</button>' +
        '<button class="btn btn-ghost" data-action="coach-del" data-id="' + esc(c.name) + '">删除</button>' +
        "</div></div>"
      );
    }).join("");
    return (
      pageHead("教练管理",
        '<button class="btn btn-primary" data-action="coach-new">＋ 新增教练</button>') +
      '<div class="section-title" style="margin-top:0">教练 · 共 ' + list.length + " 人</div>" +
      '<div class="card" style="margin-bottom:12px"><div style="font-size:13px;color:var(--muted);line-height:1.8">' +
      "教练名同时作为<b>登录账号</b>，密码用于右上角「登录」；新增后即可在排课时选择该教练。</div></div>" +
      (list.length ? '<div class="card mgmt-list">' + cards + "</div>" : '<div class="card"><div class="empty">还没有教练</div></div>')
    );
  }
  function openCoachForm(name) {
    const c = name ? (S.coaches || []).find((x) => x.name === name) : null;
    const role = c ? (c.role === "coach" ? "coach" : "admin") : "coach";
    openModal(
      '<div class="modal-head">' + (c ? "编辑教练" : "新增教练") + ' <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>教练姓名（= 登录账号）*</label><input id="coName" value="' + esc(c ? c.name : "") + '" /></div>' +
      '<div class="field"><label>登录密码 *</label><input id="coPass" value="' + esc(c ? c.pass : "") + '" /></div>' +
      '<div class="field"><label>账号类型 *</label><select id="coRole">' +
      '<option value="coach"' + (role === "coach" ? " selected" : "") + ">教练账号（只能用：课表信息 / 销课记录 / 用户信息）</option>" +
      '<option value="admin"' + (role === "admin" ? " selected" : "") + ">管理员账号（全部功能）</option>" +
      "</select></div>" +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-action="coach-save" data-id="' + esc(c ? c.name : "") + '">保存</button></div>'
    );
  }
  function saveCoach(oldName) {
    const coName = document.getElementById("coName");
    const coPass = document.getElementById("coPass");
    const coRole = document.getElementById("coRole");
    const name = coName ? coName.value.trim() : "";
    const pass = coPass ? coPass.value.trim() : "";
    const role = coRole && coRole.value === "coach" ? "coach" : "admin";
    if (!name) { toast("请填写教练姓名"); return; }
    if (!pass) { toast("请填写登录密码"); return; }
    S.coaches = S.coaches || [];
    if (oldName) {
      const c = S.coaches.find((x) => x.name === oldName);
      if (!c) return;
      if (name !== oldName && S.coaches.some((x) => x.name === name)) { toast("该教练名已存在"); return; }
      const wasAdmin = !c.role || c.role === "admin";
      if (wasAdmin && role !== "admin" && adminCount() <= 1) { toast("至少要保留一个管理员账号"); return; }
      if (name !== oldName) S.classes.forEach((x) => { if (x.coach === oldName) x.coach = name; });
      c.name = name;
      c.pass = pass;
      c.role = role;
      if (S.user && S.user.name === oldName) S.user.name = name;
      toast("已保存教练");
    } else {
      if (S.coaches.some((x) => x.name === name)) { toast("该教练名已存在"); return; }
      S.coaches.push({ name: name, pass: pass, role: role, joinedAt: todayKey() });
      toast("已新增教练：" + name);
    }
    saveState();
    closeModal();
    render();
  }
  function delCoach(name) {
    const c = (S.coaches || []).find((x) => x.name === name);
    if (!c) return;
    if (S.coaches.length <= 1) { toast("至少要保留一个教练账号"); return; }
    if ((!c.role || c.role === "admin") && adminCount() <= 1) { toast("至少要保留一个管理员账号"); return; }
    const used = S.classes.filter((x) => x.coach === name).length;
    if (confirm("确定删除教练「" + name + "」吗？" + (used ? "有 " + used + " 节排课挂在其名下。" : ""))) {
      S.coaches = S.coaches.filter((x) => x.name !== name);
      saveState();
      render();
      toast("已删除教练");
    }
  }

  /* ---------------- 销课 ---------------- */
  function viewRecord() {
    const all = visibleRecords();
    const c60 = all.filter((r) => r.type === "60分钟").length;
    const cTrial = all.filter((r) => r.type === "体验课").length;
    const list = all;
    const rows = list.length
      ? list.map(function (r) {
          const rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
          return '<div class="list-item"><div class="li-main"><b>' + esc(r.student) + " · " + esc(r.course || r.subject) +
            "</b><small>" + r.date + " · " + esc(r.type) + " · 正确率 " + rate + '%</small></div><span class="li-h">' +
            (r.minutes || 0) + "′</span>" +
            '<button class="btn" style="margin-left:12px;padding:6px 12px;font-size:12.5px" data-action="rec-words" data-id="' + r.id + '">导出</button></div>';
        }).join("")
      : '<div class="empty">还没有销课记录，上完课会自动生成</div>';
    return (
      pageHead("销课记录",
        '<button class="btn btn-ghost" data-action="export-mini">导出给小程序</button>' +
        '<button class="btn btn-ghost" data-action="export-records">导出 CSV</button>') +
      '<div class="card"><div class="stat-grid">' +
      '<div class="stat"><b>' + c60 + "</b><span>60分钟课</span></div>" +
      '<div class="stat"><b>' + cTrial + "</b><span>体验课</span></div>" +
      '<div class="stat"><b>' + all.length + "</b><span>上课总次数</span></div></div></div>" +
      '<div class="section-title">共 ' + list.length + ' 条</div>' +
      '<div class="card">' + rows + "</div>"
    );
  }

  /* ---------------- 抗遗忘（督学管理） ---------------- */
  function antiRow(r) {
    const rec = reviewRecord(r);
    const n = rec ? (rec.words || []).length : 0;
    const today = todayKey();
    const done = r.status === "已完成";
    const overdue = !done && r.date < today;
    const due = !done && r.date <= today;
    const badge = done
      ? '<span class="badge done">已完成</span>'
      : overdue
        ? '<span class="badge live">已逾期</span>'
        : due
          ? '<span class="badge wait">今日</span>'
          : '<span class="badge" style="background:#f1f2f6;color:var(--muted)">待到期</span>';
    const right = done
      ? '<span class="li-h">✅ ' + (r.correct || 0) + " · ❌ " + Math.max(0, (r.total || 0) - (r.correct || 0)) + "</span>"
      : '<button class="btn btn-primary" style="padding:8px 16px" data-action="anti-start" data-id="' + r.id + '">去复习</button>';
    return (
      '<div class="list-item"><div class="li-main">' +
      "<b>" + esc(r.student || "") + (r.course ? " · " + esc(r.course) : "") + "</b>" +
      "<small>第 " + r.round + " 次 · " + r.date + " · " + n + " 个单词" +
      (rec ? "" : " · ⚠ 原销课记录已找不到") + "</small></div>" +
      badge + '<div style="margin-left:10px">' + right + "</div></div>"
    );
  }
  function viewReview() {
    const list = visibleReviews();
    const today = todayKey();
    const pending = list.filter((r) => r.status !== "已完成").sort((a, b) => a.date.localeCompare(b.date) || a.round - b.round);
    const due = pending.filter((r) => r.date <= today);
    const future = pending.filter((r) => r.date > today);
    const done = list.filter((r) => r.status === "已完成").sort((a, b) => (b.doneAt || b.date).localeCompare(a.doneAt || a.date));
    const overdue = due.filter((r) => r.date < today).length;
    return (
      pageHead("抗遗忘") +
      '<div class="card"><div class="stat-grid">' +
      '<div class="stat"><b>' + (due.length - overdue) + "</b><span>今日待复习</span></div>" +
      '<div class="stat"><b>' + overdue + "</b><span>已逾期</span></div>" +
      '<div class="stat"><b>' + done.length + "</b><span>已完成</span></div></div></div>" +
      '<div class="section-title">待复习（' + due.length + "）</div>" +
      '<div class="card">' + (due.length ? due.map(antiRow).join("") : '<div class="empty">今天没有需要复习的</div>') + "</div>" +
      '<div class="section-title">后续复习（' + future.length + "）</div>" +
      '<div class="card">' + (future.length ? future.map(antiRow).join("") : '<div class="empty">暂无排期</div>') + "</div>" +
      '<div class="section-title">已完成（' + done.length + "）</div>" +
      '<div class="card">' + (done.length ? done.slice(0, 50).map(antiRow).join("") : '<div class="empty">还没有完成记录</div>') + "</div>"
    );
  }
  function currentAntiReview() {
    return (S.reviews || []).find((x) => x.id === (lesson && lesson.reviewId)) || null;
  }
  function viewAnti() {
    const r = currentAntiReview();
    const words = (lesson && lesson.all) || [];
    return (
      '<div class="section-title" style="margin-top:2px">抗遗忘 · 第 ' + (r ? r.round : "") + " 次 · " +
      esc(r ? r.student : "") + " · 共 " + words.length + " 个单词</div>" +
      '<div class="card sticky-bar" style="display:flex;align-items:center;gap:12px">' +
      '<div id="gridMeta" style="flex:1;font-size:13.5px">' + gridMetaHtml() + "</div>" +
      '<div id="gridBtns" style="display:flex;gap:8px">' + gridBtnsHtml() + "</div></div>" +
      gridHtml(words)
    );
  }
  function startAntiReview(id) {
    const r = (S.reviews || []).find((x) => x.id === id);
    if (!r) return;
    const rec = reviewRecord(r);
    if (!rec) { toast("找不到对应的销课记录"); return; }
    const words = (rec.words || []).map((w) => ({ w: w.w, ph: w.ph, m: w.m }));
    if (!words.length) { toast("这节课没有单词记录"); return; }
    lesson = {
      mode: "anti", reviewId: r.id, phase: "anti",
      studentId: r.studentId, courseId: r.courseId,
      all: words, marks: {}, gridState: {},
    };
    route.name = "anti";
    render();
  }
  function submitAnti() {
    const r = currentAntiReview();
    if (!r) return;
    const words = (lesson && lesson.all) || [];
    const wrong = words.filter((w) => lesson.marks[w.w] === false);
    const ok = words.length - wrong.length;
    r.status = "已完成";
    r.doneAt = todayKey();
    r.total = words.length;
    r.correct = ok;
    r.wrongWords = wrong.map((w) => w.w);
    saveState();
    const rows = wrong.length
      ? wrong.map((w) => '<div class="word-row"><span class="en">' + esc(w.w) + '</span><span class="cn">' + esc(w.m) + "</span></div>").join("")
      : '<div class="empty">全部答对，太棒了 🎉</div>';
    lesson = null;
    route.name = "review";
    render();
    openModal(
      '<div class="modal-head">抗遗忘完成 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<div style="font-size:13px;color:var(--muted);margin-bottom:10px">' + esc(r.student || "") + " · 第 " + r.round + " 次</div>" +
      '<div class="outcome" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="o ok"><b>' + ok + "</b><span>答对</span></div>" +
      '<div class="o bad"><b>' + wrong.length + "</b><span>答错</span></div>" +
      '<div class="o brand"><b>' + (words.length ? Math.round((ok / words.length) * 100) : 0) + "%</b><span>正确率</span></div></div>" +
      '<div class="section-title">答错的单词（' + wrong.length + "）</div>" + rows + "</div>" +
      '<div class="modal-foot"><button class="btn btn-primary" data-action="close-modal">完成</button></div>'
    );
  }

  /* ---------------- 我的 ---------------- */
  function viewMe() {
    const mine = visibleRecords();
    const totalMin = mine.reduce((a, r) => a + (r.minutes || 0), 0);
    const trial = mine.filter((r) => r.type === "体验课").length;
    const recs = mine.length
      ? mine.slice(0, 20).map((r) =>
          '<div class="list-item"><div class="li-main"><b>' + esc(r.student) + " · " + esc(r.course || r.subject) +
          "</b><small>" + r.date + " · " + esc(r.type) + '</small></div><span class="li-h">' + (r.minutes || 0) + "′</span></div>").join("")
      : '<div class="empty">还没有上课记录</div>';
    return (
      pageHead("用户信息") +
      '<div class="card"><div class="stat-grid">' +
      '<div class="stat"><b>' + totalMin + "</b><span>累计时长(分)</span></div>" +
      '<div class="stat"><b>' + mine.length + "</b><span>上课总次数</span></div>" +
      '<div class="stat"><b>' + trial + "</b><span>体验课次数</span></div></div></div>" +
      '<div class="section-title">最近上课</div><div class="card">' + recs + "</div>" +
      (isAdmin()
        ? '<div class="section-title">数据管理</div>' +
          '<div class="card">' +
          '<div class="li-main" style="margin-bottom:12px"><b>备份 / 恢复</b>' +
          "<small>换电脑、换浏览器或重装前先备份，之后用恢复把学员/教练/词库/排课/记录搬回来</small></div>" +
          '<div style="display:flex;gap:10px">' +
          '<button class="btn btn-primary" style="flex:1;padding:12px" data-action="open-backup">备份数据</button>' +
          '<button class="btn" style="flex:1;padding:12px" data-action="open-restore">恢复数据</button>' +
          "</div>" +
          '<div style="margin-top:14px"><button class="btn btn-ghost btn-block" data-action="clear-all">清空上课数据（保留学员和词库）</button></div>' +
          "</div>"
        : "") +
      '<div style="margin-top:12px"><button class="btn btn-danger btn-block" data-action="logout">退出登录</button></div>'
    );
  }
  function clearAllButMine() {
    S = {
      students: (S.students || []).map((s) => Object.assign({}, s)),
      classes: [],
      records: [],
      wrong: [],
      progress: {},
      courses: (S.courses || []).slice(),
      coaches: (S.coaches || []).slice(),
      user: S.user || null,
      sidebarCollapsed: !!S.sidebarCollapsed,
    };
    saveState();
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!isAdmin() && ADMIN_ONLY_ROUTES.indexOf(route.name) >= 0) {
      route.name = "schedule";
      route.day = todayKey();
    }
    const v = document.getElementById("view");
    if (route.name === "dashboard") v.innerHTML = viewDashboard();
    else if (route.name === "schedule") v.innerHTML = viewSchedule();
    else if (route.name === "teach") v.innerHTML = viewTeach();
    else if (route.name === "course") v.innerHTML = viewCourse();
    else if (route.name === "lesson") v.innerHTML = viewLesson();
    else if (route.name === "record") v.innerHTML = viewRecord();
    else if (route.name === "review") v.innerHTML = viewReview();
    else if (route.name === "anti") v.innerHTML = viewAnti();
    else if (route.name === "library") v.innerHTML = viewLibrary();
    else if (route.name === "student") v.innerHTML = viewStudentDetail();
    else if (route.name === "students") v.innerHTML = viewStudents();
    else if (route.name === "coaches") v.innerHTML = viewCoaches();
    else v.innerHTML = viewMe();
    const map = { dashboard: "dashboard", schedule: "schedule", teach: "schedule", course: "schedule", lesson: "schedule", students: "students", student: "students", coaches: "coaches", record: "record", library: "library", review: "review", anti: "review", me: "me" };
    const active = map[route.name] || route.name;
    $$("#tabbar .tab").forEach((b) => b.classList.toggle("is-active", b.dataset.nav === active));
    renderHeader();
    applySidebar();
    applyNavRole();
    applyNavGroups();
    v.scrollTop = 0;
  }

  /* ---------------- 弹窗 ---------------- */
  function openModal(inner) {
    document.getElementById("modalRoot").innerHTML =
      '<div class="modal-backdrop" data-action="backdrop"><div class="modal">' + inner + "</div></div>";
  }
  function closeModal() {
    if (breakTimer) { clearInterval(breakTimer); breakTimer = null; }
    breakRunning = false;
    breakRemaining = 5 * 60 * 1000;
    document.getElementById("modalRoot").innerHTML = "";
  }
  const studentOptions = (selectedId) =>
    S.students.map((s) => '<option value="' + s.id + '"' + (s.id === selectedId ? " selected" : "") + ">" + esc(s.name) + "</option>").join("");
  function coachOptions(selected) {
    const list = (S.coaches || []).map((c) => c.name);
    if (S.user && list.indexOf(S.user.name) < 0) list.push(S.user.name);
    S.classes.forEach((c) => { if (c.coach && list.indexOf(c.coach) < 0) list.push(c.coach); });
    if (selected && list.indexOf(selected) < 0) list.push(selected);
    return list
      .map((n) => '<option value="' + esc(n) + '"' + (n === selected ? " selected" : "") + ">" + esc(n) + "</option>")
      .join("");
  }
  function openScheduleModal(presetStudentId, editId) {
    const c = editId ? S.classes.find((x) => x.id === editId) : null;
    const stuId = c ? c.studentId : presetStudentId;
    const date = c ? c.date : route.day;
    const time = c ? c.time : "16:00";
    const typeKey = c ? c.type : TYPES[0].key;
    const subjKey = c ? c.subject : SUBJECTS[0];
    const coachDefault = (c && c.coach) || (S.user && S.user.name) || "Diana";
    openModal(
      '<div class="modal-head">' + (c ? "编辑排课" : "新增排课") + ' <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>学员</label><select id="fStudent">' + studentOptions(stuId) + "</select></div>" +
      '<div class="field"><label>教练</label><select id="fCoach">' + coachOptions(coachDefault) + "</select></div>" +
      '<div class="field"><label>日期</label><input type="date" id="fDate" value="' + date + '" /></div>' +
      '<div class="field"><label>开始时间</label><input type="time" id="fTime" value="' + time + '" /></div>' +
      '<div class="field"><label>课程时长</label><div class="seg" id="fType">' +
      TYPES.map((t) => '<button type="button" class="' + (t.key === typeKey ? "is-active" : "") + '" data-seg="1" data-type="' + t.key + '">' + t.label + "</button>").join("") +
      "</div></div>" +
      '<div class="field"><label>科目</label><div class="seg" id="fSubject">' +
      SUBJECTS.map((s) => '<button type="button" class="' + (s === subjKey ? "is-active" : "") + '" data-seg="1" data-subj="' + s + '">' + s + "</button>").join("") +
      "</div></div></div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-action="save-schedule" data-id="' + (c ? c.id : "") + '">' + (c ? "保存修改" : "保存排课") + "</button></div>"
    );
  }
  function saveSchedule(editId) {
    const typeEl = $("#fType .is-active");
    const subjEl = $("#fSubject .is-active");
    const date = $("#fDate").value || route.day;
    const patch = {
      studentId: $("#fStudent").value,
      coach: $("#fCoach") ? $("#fCoach").value : ((S.user && S.user.name) || "Diana"),
      date: date,
      time: $("#fTime").value || "16:00",
      type: typeEl ? typeEl.dataset.type : "60",
      subject: subjEl ? subjEl.dataset.subj : "单词",
    };
    if (editId) {
      const c = S.classes.find((x) => x.id === editId);
      if (c) Object.assign(c, patch);
      toast("已保存修改");
    } else {
      S.classes.push(Object.assign(
        { id: uid(), status: "待上课", coach: (S.user && S.user.name) || "Diana" },
        patch
      ));
      toast("排课成功");
    }
    saveState();
    closeModal();
    route.day = date;
    render();
  }
  function openStudentForm(id) {
    const s = id ? studentById(id) : null;
    const gradeOpts = ['<option value="">未填写</option>'].concat(
      GRADES.map((g) => '<option value="' + g + '"' + (s && s.grade === g ? " selected" : "") + ">" + g + "</option>")
    ).join("");
    openModal(
      '<div class="modal-head">' + (s ? "编辑学员" : "新增学员") + ' <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>姓名 *</label><input id="sName" value="' + esc(s ? s.name : "") + '" /></div>' +
      '<div class="field"><label>手机号</label><input id="sPhone" value="' + esc(s ? s.phone : "") + '" /></div>' +
      '<div class="field"><label>年级</label><select id="sGrade">' + gradeOpts + "</select></div>" +
      '<div class="field"><label>学校</label><input id="sSchool" value="' + esc(s ? s.school : "") + '" /></div>' +
      '<div class="field"><label>备注</label><input id="sRemark" value="' + esc(s ? s.remark : "") + '" /></div>' +
      '<div class="field"><label>家长登录密码</label><input id="sPass" value="' + esc(s && s.pass ? s.pass : "") +
      '" placeholder="留空则默认 123456" /></div>' +
      (s ? "" : '<div class="field"><label>初始课时（60分钟）</label><input id="sHours" type="number" min="0" value="0" /></div>') +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-action="stu-save" data-id="' + (s ? s.id : "") + '">保存</button></div>'
    );
  }
  function saveStudent(id) {
    const name = $("#sName").value.trim();
    // 以下是新增/编辑学员的保存逻辑
    if (!name) { toast("请填写学员姓名"); return; }
    const patch = { name: name, phone: $("#sPhone").value.trim(), grade: $("#sGrade").value, school: $("#sSchool").value.trim(), remark: $("#sRemark").value.trim() };
    const passEl = $("#sPass");
    if (passEl) patch.pass = passEl.value.trim();
    if (id) { Object.assign(studentById(id), patch); toast("已保存学员信息"); }
    else {
      S.students.push(Object.assign(
        { id: uid(), hours: Math.max(0, parseInt($("#sHours").value, 10) || 0), status: "正常", courses: [], joinedAt: todayKey(), rechargeLog: [] },
        patch
      ));
      toast("已新增学员：" + name);
    }
    saveState(); closeModal(); render();
  }
  /* 删除学员（仅限已禁用的账号）：删掉排课 / 抗遗忘 / 进度，保留销课记录（消费历史） */
  function delStudent(id) {
    const s = studentById(id);
    if (!s) return;
    if (s.status !== "禁用") { toast("请先在「更多」里禁用该账号，再删除"); return; }
    const recN = (S.records || []).filter((r) => r.studentId === id || r.student === s.name).length;
    const clsN = (S.classes || []).filter((c) => c.studentId === id).length;
    const revN = (S.reviews || []).filter((r) => r.studentId === id).length;
    if (!confirm("确定删除学员「" + s.name + "」吗？\n\n会删除：\n· " + clsN + " 节排课\n· " + revN + " 次抗遗忘\n· 该学员的学习进度\n\n会保留：\n· " + recN + " 条销课记录（消费历史）\n· 其他学员不受影响")) return;
    S.classes = (S.classes || []).filter((c) => c.studentId !== id);
    S.reviews = (S.reviews || []).filter((r) => r.studentId !== id);
    Object.keys(S.progress || {}).forEach(function (k) {
      if (k.indexOf(id + "::") === 0) delete S.progress[k];
    });
    S.students = S.students.filter((x) => x.id !== id);
    if (currentStudentId === id) { currentStudentId = null; route.name = "students"; }
    saveState();
    render();
    toast("已删除学员：" + s.name);
  }
  function openRecharge(id) {
    const s = studentById(id);
    if (!s) return;
    openModal(
      '<div class="modal-head">充值课时 · ' + esc(s.name) + ' <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body"><p style="color:var(--muted);font-size:13px;margin:0 0 12px">当前剩余 <b style="color:var(--brand)">' +
      (s.hours || 0) + "</b> 节（60分钟课）</p>" +
      '<div class="field"><label>充值课时数</label><input id="rCount" type="number" min="1" value="10" /></div>' +
      '<div class="field"><label>备注</label><input id="rNote" placeholder="如：家长续费 10 节" /></div></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-action="recharge-save" data-id="' + id + '">确认充值</button></div>'
    );
  }
  function saveRecharge(id) {
    const s = studentById(id);
    const n = parseInt($("#rCount").value, 10);
    if (!s || !n || n <= 0) { toast("请输入正确的课时数"); return; }
    s.hours = (s.hours || 0) + n;
    s.rechargeLog = s.rechargeLog || [];
    s.rechargeLog.unshift({ date: todayKey(), count: n, note: $("#rNote").value.trim() });
    saveState(); closeModal(); render();
    toast("充值成功，+" + n + " 节");
  }
  function openCourseGrant(id) {
    const s = studentById(id);
    if (!s) return;
    grantDraft = (s.courses || []).slice();
    const rows = S.courses.map(function (c) {
      const on = grantDraft.indexOf(c.id) >= 0;
      return '<div class="chk-row" data-action="grant-toggle" data-id="' + c.id + '">' +
        '<span class="chk ' + (on ? "on" : "") + '">✓</span>' +
        '<div class="cm"><b>' + esc(c.name) + "</b><small>共 " + courseSize(c) + " 词 · 已学 " + learnedCount(s.id, c.id) + "</small></div></div>";
    }).join("");
    openModal(
      '<div class="modal-head">课程开通 · ' + esc(s.name) + ' <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body"><p style="color:var(--muted);font-size:12.5px;margin:0 0 8px">勾选要给该学员开通的词库（自建词库稍后可上传）。</p>' +
      rows + "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button>' +
      '<button class="btn btn-primary" data-action="grant-save" data-id="' + id + '">保存</button></div>'
    );
  }
  function openMore(id) {
    const s = studentById(id);
    if (!s) return;
    const disabled = s.status === "禁用";
    openModal(
      '<div class="modal-head">更多操作 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body"><div class="li-main" style="margin-bottom:12px"><b>' + esc(s.name) + "</b><small>当前状态：" +
      (disabled ? "已禁用" : "正常") + "</small></div>" +
      '<button class="btn ' + (disabled ? "btn-primary" : "btn-ghost") + ' btn-block" data-action="stu-toggle-status" data-id="' + id + '">' +
      (disabled ? "启用此账号" : "禁用此账号") + "</button></div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>'
    );
  }
  function openSudoku() {
    const groups = groupsOf(S.wrong, 5);
    const cells = Array.from({ length: 9 }, function (_, i) {
      const g = groups[i];
      if (!g || !g.length) return '<button class="cell empty" disabled><b>—</b><span>无单词</span></button>';
      return '<button class="cell" data-action="review-cell" data-cell="' + i + '"><b>' + g.length + "</b><span>第" + (i + 1) + "格</span></button>";
    }).join("");
    openModal(
      '<div class="modal-head">抗遗忘 · 九宫格 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body"><p style="color:var(--muted);font-size:12.5px;line-height:1.7;margin:0 0 10px">选择一个格子复习该组单词；空格子表示没有可复习的单词。</p>' +
      '<div class="sudoku">' + cells + "</div></div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>'
    );
  }
  function openWrongBook() {
    const rows = S.wrong.length
      ? S.wrong.map((x) => '<div class="word-row"><span class="en">' + esc(x.w) + '</span><span class="cn">' + esc(x.m) + "</span></div>").join("")
      : '<div class="empty">错题本是空的，去上课吧~</div>';
    openModal(
      '<div class="modal-head">错题本（' + S.wrong.length + '） <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' + rows + "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>'
    );
  }
  function openBreak() {
    breakRemaining = 5 * 60 * 1000;
    breakRunning = false;
    openModal(
      '<div class="modal-head">休息时间 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body"><div class="break-timer"><div class="big" id="breakTime">05:00</div><p>让眼睛和大脑休息一下</p></div></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="break-toggle" id="breakBtn">开始计时</button>' +
      '<button class="btn btn-primary" data-action="close-modal">结束休息</button></div>'
    );
  }
  function breakToggle() {
    const btn = document.getElementById("breakBtn");
    if (breakRunning) {
      breakRunning = false;
      if (breakTimer) { clearInterval(breakTimer); breakTimer = null; }
      if (btn) btn.textContent = "继续计时";
      return;
    }
    if (breakRemaining <= 0) breakRemaining = 5 * 60 * 1000;
    breakRunning = true;
    if (btn) btn.textContent = "暂停";
    const end = Date.now() + breakRemaining;
    breakTimer = setInterval(function () {
      breakRemaining = Math.max(0, end - Date.now());
      const t = document.getElementById("breakTime");
      if (t) t.textContent = pad2(Math.floor(breakRemaining / 60000)) + ":" + pad2(Math.floor((breakRemaining % 60000) / 1000));
      if (breakRemaining <= 0) {
        clearInterval(breakTimer); breakTimer = null; breakRunning = false;
        const b = document.getElementById("breakBtn");
        if (b) b.textContent = "重新计时";
        toast("休息结束，继续加油！");
      }
    }, 200);
  }
  function exportRecords(list, filename) {
    const rows = [["日期", "学员", "课程", "类型", "题数", "正确", "正确率", "时长(分)"]];
    list.forEach((r) => rows.push([
      r.date, r.student, r.course || r.subject || "", r.type, r.total || 0, r.correct || 0,
      r.total ? Math.round((r.correct / r.total) * 100) + "%" : "-", r.minutes || 0,
    ]));
    downloadCSV(filename, rows);
    toast("已导出 " + (rows.length - 1) + " 条记录");
  }
  function exportRecordWords(rec, kind) {
    const words = rec.words || [];
    if (!words.length) { toast("这条记录没有单词明细"); return; }
    const label = { both: "中英文", cn: "纯中文", en: "纯英文", ph: "纯音标" }[kind] || "中英文";
    let rows;
    if (kind === "cn") rows = [["中文"]].concat(words.map((w) => [w.m]));
    else if (kind === "en") rows = [["英文"]].concat(words.map((w) => [w.w]));
    else if (kind === "ph") rows = [["音标"]].concat(words.map((w) => [w.ph]));
    else rows = [["英文", "中文"]].concat(words.map((w) => [w.w, w.m]));
    downloadCSV([rec.student, rec.course || "", rec.date, label].join("-") + ".csv", rows);
    toast("已导出：" + label + "（" + words.length + " 个单词）");
  }
  function openWordExport(rec) {
    if (!rec || !rec.words || !rec.words.length) { toast("这条记录没有单词明细（旧记录不支持）"); return; }
    const opts = [["both", "中英文对照"], ["cn", "纯中文"], ["en", "纯英文"], ["ph", "纯音标"]];
    openModal(
      '<div class="modal-head">导出本课单词 <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body"><p style="color:var(--muted);font-size:12.5px;margin:0 0 12px">' +
      esc(rec.student) + " · " + esc(rec.course || "") + " · " + rec.date + " · 共 " + rec.words.length + " 个单词</p>" +
      opts.map(function (o) {
        return '<div class="export-row"><span>' + o[1] + "</span><div>" +
          '<button class="btn" data-action="word-export-one" data-kind="' + o[0] + '" data-fmt="csv" data-id="' + rec.id + '">CSV</button>' +
          '<button class="btn btn-primary" data-action="word-export-one" data-kind="' + o[0] + '" data-fmt="pdf" data-id="' + rec.id + '">PDF</button>' +
          "</div></div>";
      }).join("") +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>'
    );
  }
  function wordListLabel(kind) {
    return { both: "中英文对照", cn: "纯中文", en: "纯英文", ph: "纯音标" }[kind] || "中英文对照";
  }
  function buildPrintArea(rec, kind) {
    const words = rec.words || [];
    let inner;
    if (kind === "cn") inner = '<div class="plist">' + words.map((w, i) => i + 1 + ". " + esc(w.m)).join("<br>") + "</div>";
    else if (kind === "en") inner = '<div class="plist">' + words.map((w, i) => i + 1 + ". " + esc(w.w)).join("<br>") + "</div>";
    else if (kind === "ph") inner = '<div class="plist">' + words.map((w, i) => i + 1 + ". " + esc(w.ph)).join("<br>") + "</div>";
    else {
      inner = '<table class="ptable">' +
        words.map((w) => "<tr><td>" + esc(w.w) + "</td><td>" + esc(w.m) + "</td></tr>").join("") +
        "</table>";
    }
    document.getElementById("printArea").innerHTML =
      "<h1>" + esc(rec.course || "单词表") + "</h1>" +
      '<div class="pmeta">' + esc(rec.student || "") + " · " + (rec.date || "") + " · " +
      wordListLabel(kind) + " · 共 " + words.length + " 个单词</div>" +
      inner +
      '<div class="pfoot">蜗牛智学 · 单词带背</div>';
  }
  function printWords(rec, kind) {
    if (!rec || !rec.words || !rec.words.length) { toast("这条记录没有单词明细（旧记录不支持）"); return; }
    buildPrintArea(rec, kind);
    const old = document.title;
    document.title = [rec.student, rec.course || "", rec.date, wordListLabel(kind)].join("-");
    try {
      window.print();
    } catch (e) {
      toast("当前环境不支持打印，请改用 CSV");
    }
    document.title = old;
  }
  function openPrintPreview(rec, kind) {
    if (!rec || !rec.words || !rec.words.length) { toast("这条记录没有单词明细（旧记录不支持）"); return; }
    buildPrintArea(rec, kind);
    openModal(
      '<div class="modal-head">PDF 预览 · ' + wordListLabel(kind) + ' <span class="x" data-action="close-modal">×</span></div>' +
      '<div class="modal-body">' +
      '<div class="print-preview">' + document.getElementById("printArea").innerHTML + "</div>" +
      '<p style="color:var(--muted);font-size:12px;line-height:1.7;margin:10px 0 0">点「打印 / 另存为 PDF」后，在打印窗口的「目标（打印机）」里选择 <b>另存为 PDF</b>，即可保存成 PDF 文件。</p>' +
      "</div>" +
      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-action="rec-words" data-id="' + rec.id + '">返回</button>' +
      '<button class="btn btn-primary" data-action="do-print" data-id="' + rec.id + '" data-kind="' + kind + '">打印 / 另存为 PDF</button>' +
      "</div>"
    );
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener("click", function (e) {
    const navBtn = e.target.closest("[data-nav]");
    if (navBtn) {
      if (navBtn.dataset.nav === "students") stuSearch = "";
      route.name = navBtn.dataset.nav;
      if (route.name === "schedule") route.day = todayKey();
      render();
      return;
    }
    const seg = e.target.closest('[data-seg="1"]');
    if (seg) {
      $$('[data-seg="1"]', seg.parentElement).forEach((b) => b.classList.remove("is-active"));
      seg.classList.add("is-active");
      return;
    }
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const a = t.dataset.action;
    const id = t.dataset.id;
    const w = t.dataset.w;
    switch (a) {
      case "backdrop": if (e.target === t) closeModal(); break;
      case "close-modal": closeModal(); break;
      case "login": openLogin(); break;
      case "do-login": doLogin(); break;
      case "logout": doLogout(); break;
      case "gate-login": doGateLogin(); break;
      case "toggle-supervise": toggleSupervise(); break;
      case "open-backup": openBackup(); break;
      case "copy-backup": copyBackup(); break;
      case "export-mini": openMiniExport(); break;
      case "copy-mini": copyMini(); break;
      case "open-restore": openRestore(); break;
      case "do-restore": doRestore(); break;
      case "toggle-sidebar":
        S.sidebarCollapsed = !S.sidebarCollapsed;
        saveState();
        applySidebar();
        break;
      case "nav-to":
        route.name = t.dataset.goto;
        if (route.name === "schedule") route.day = todayKey();
        if (route.name === "students") stuSearch = "";
        render();
        break;
      /* 排课 */
      case "week-prev": weekOffset--; render(); break;
      case "week-next": weekOffset++; render(); break;
      case "pick-day": route.day = t.dataset.date; render(); break;
      case "pick-subject": route.subject = t.dataset.subject; render(); break;
      case "open-schedule": openScheduleModal(null); break;
      case "edit-class": openScheduleModal(null, id); break;
      case "del-class": {
        const c = S.classes.find((x) => x.id === id);
        if (c) {
          const stu = studentById(c.studentId);
          if (confirm("确定删除这节课吗？\n" + c.date + " " + c.time + " · " + (stu ? stu.name : "未知学员") + " · " + c.subject)) {
            S.classes = S.classes.filter((x) => x.id !== id);
            saveState();
            render();
            toast("已删除排课");
          }
        }
        break;
      }
      case "save-schedule": saveSchedule(id); break;
      case "start-class": {
        const c = S.classes.find((x) => x.id === id);
        pending = { studentId: c ? c.studentId : null, classId: id };
        lesson = null; currentCourseId = null;
        route.name = "teach"; render();
        break;
      }
      case "teach-exit": pending = null; route.name = "schedule"; render(); break;
      case "course-open":
        if (pending) {
          currentCourseId = id;
          currentCourseStudentId = pending.studentId;
          route.name = "course";
          lesson = null;
          render();
        }
        break;
      case "teach-back": route.name = "teach"; render(); break;
      case "start-new": startNew(currentCourseId); break;
      case "start-review-course": startReviewCourse(currentCourseId); break;
      /* 学前/学后检测 */
      case "grid-word": {
        cycleGridWord(w);
        break;
      }
      case "grid-ok": markGrid(w, true); break;
      case "grid-no": markGrid(w, false); break;
      case "pretest-submit": submitPretest(); break;
      case "pretest-done": confirmAllKnown(); break;
      case "do-finish-all": closeModal(); finishAllKnown(); break;
      case "switch-course": switchCourse(); break;
      case "posttest-submit": submitPosttest(); break;
      /* 抗遗忘 */
      case "anti-start": startAntiReview(id); break;
      case "anti-submit": submitAnti(); break;
      case "anti-quit": lesson = null; route.name = "review"; render(); break;
      /* 识记 */
      case "study-word": cycleStudyWord(w); break;
      case "block-next": blockDone(); break;
      /* 听音识义 */
      case "listen-play": speak(lesson.list[lesson.idx].w); break;
      case "listen-answer": answerListen(t.dataset.value); break;
      /* 剪纸盒 */
      case "cut-reveal": cycleCutWord(w); break;
      case "cut-ok": markCut(w, true); break;
      case "cut-no": markCut(w, false); break;
      case "summary-mix": {
        const gi = lesson.block.gi;
        const mg = (MIX_AFTER[gi] || []).slice();
        lesson.blocks.splice(
          lesson.bi + 1, 0,
          { kind: "cut", gi: gi, order: "shuffle", mix: mg.slice() },
          { kind: "cut", gi: gi, order: "seq", mix: mg.slice() },
          { kind: "summary", gi: gi, mix: mg.slice() }
        );
        lesson.bi++;
        enterBlock();
        break;
      }
      /* 小结 */
      case "summary-redo": {
        const gi = lesson.block.gi;
        let si = lesson.blocks.findIndex((b) => !b.groups && b.gi === gi && (b.kind === "study" || b.kind === "cut"));
        if (si < 0) si = 0;
        lesson.bi = si;
        enterBlock();
        break;
      }
      case "summary-next": lesson.bi++; enterBlock(); break;
      case "summary-post":
        lesson.postWords = groupsUpTo(lesson.block.gi);
        lesson.phase = "posttest";
        lesson.marks = {}; lesson.gridState = {}; lesson.gridIdx = 0;
        render();
        break;
      /* 结束 */
      case "result-continue": {
        persistRound();
        const sid = lesson.studentId;
        const cid = lesson.courseId;
        const clid = lesson.classId;
        const remain = newPoolWords(sid, cid).length;
        if (!remain) {
          toast("这个词库的单词已经全部学完啦");
          route.name = "course";
          lesson = null;
          render();
        } else {
          startNew(cid, sid, clid);
          toast("继续学习：还剩 " + remain + " 个单词");
        }
        break;
      }
      case "result-finish": finishWithAnti(); break;
      case "lesson-quit":
        lesson = null;
        route.name = currentCourseId ? "course" : "schedule";
        if (route.name === "schedule") pending = null;
        render();
        toast("已退出本次学习");
        break;
      /* 工具 */
      case "open-sudoku": openSudoku(); break;
      case "review-cell": {
        const g = groupsOf(S.wrong, 5)[parseInt(t.dataset.cell, 10)] || [];
        if (g.length) { currentCourseId = null; startReviewWordsAnti(g); }
        break;
      }
      case "open-wrong": openWrongBook(); break;
      case "open-break": openBreak(); break;
      case "break-toggle": breakToggle(); break;
      /* 学员 */
      case "stu-new": openStudentForm(null); break;
      case "stu-edit": openStudentForm(id); break;
      case "stu-save": saveStudent(id); break;
      case "stu-recharge": openRecharge(id); break;
      case "recharge-save": saveRecharge(id); break;
      case "stu-course": openCourseGrant(id); break;
      case "grant-toggle": {
        const cid = t.dataset.id;
        const i = grantDraft.indexOf(cid);
        if (i < 0) grantDraft.push(cid); else grantDraft.splice(i, 1);
        const box = t.querySelector(".chk");
        if (box) box.classList.toggle("on", grantDraft.indexOf(cid) >= 0);
        break;
      }
      case "grant-save": {
        const s = studentById(id);
        if (s) { s.courses = grantDraft.slice(); saveState(); }
        closeModal(); render();
        toast("已保存课程开通");
        break;
      }
      case "stu-more": openMore(id); break;
      case "stu-toggle-status": {
        const s = studentById(id);
        if (s) {
          s.status = s.status === "禁用" ? "正常" : "禁用";
          saveState(); closeModal(); render();
          toast(s.status === "禁用" ? "已禁用该账号" : "已启用该账号");
        }
        break;
      }
      case "stu-view": currentStudentId = id; route.name = "student"; render(); break;
      case "stu-back": route.name = "students"; render(); break;
      case "stu-del": delStudent(id); break;
      case "stu-export": {
        const s = studentById(id);
        exportRecords(visibleRecords().filter((r) => r.studentId === id || r.student === (s ? s.name : "")),
          "上课记录-" + (s ? s.name : "学员") + "-" + todayKey() + ".csv");
        break;
      }
      /* 销课 */
      case "export-records": exportRecords(visibleRecords(), "销课记录-" + todayKey() + ".csv"); break;
      case "rec-words": openWordExport(S.records.find((r) => r.id === id)); break;
      case "word-export-one": {
        const rec = S.records.find((r) => r.id === id);
        if (rec) {
          if (t.dataset.fmt === "pdf") openPrintPreview(rec, t.dataset.kind);
          else exportRecordWords(rec, t.dataset.kind);
        }
        break;
      }
      case "do-print": {
        const rec = S.records.find((r) => r.id === id);
        if (rec) printWords(rec, t.dataset.kind);
        break;
      }
      case "lib-new": openCreateCourse(); break;
      case "coach-new": openCoachForm(null); break;
      case "coach-edit": openCoachForm(id); break;
      case "coach-save": saveCoach(id); break;
      case "coach-del": delCoach(id); break;
      case "lib-save": saveCourse(); break;
      case "lib-view": openCourseWords(id); break;
      case "lib-remove": removeCourse(id); break;
      case "clear-all":
        if (confirm("将清空：全部排课、销课记录、错题本、学习进度。\n保留：学员名单、全部词库、教练账号和当前登录。\n\n确定执行吗？")) {
          clearAllButMine();
          lesson = null; pending = null; currentCourseId = null; currentCourseStudentId = null; currentStudentId = null; stuSearch = "";
          route.name = "schedule"; route.day = todayKey();
          render();
          renderHeader();
          toast("已清空排课、销课记录、错题本和学习进度");
        }
        break;
      case "reset-demo":
        if (confirm("确定重置为演示数据吗？（学员、学习进度、错题本、销课记录都会清空；你自己上传的词库会保留）")) {
          const mine = (S.courses || []).filter((c) => String(c.id).charAt(0) === "u");
          S = defaultState();
          S.courses = S.courses.concat(mine);
          saveState();
          lesson = null; pending = null; currentCourseId = null; currentStudentId = null; stuSearch = "";
          route.name = "schedule"; route.day = todayKey();
          render();
          toast(mine.length ? "已重置演示数据（保留 " + mine.length + " 个自建词库）" : "已重置演示数据");
        }
        break;
    }
  });

  document.addEventListener("input", function (e) {
    const el = e.target;
    if (el && el.id === "stuSearch") {
      stuSearch = el.value.trim();
      const host = document.getElementById("stuList");
      if (host) host.innerHTML = stuListHtml(filterStudents(stuSearch));
    }
  });

  /* 抗遗忘（错题本）复习：复用剪纸盒 */
  function startReviewWordsAnti(words) {
    lesson = {
      courseId: null, studentId: null, classId: null, mode: "review", phase: "run",
      all: [], groups: groupsOf(words, 5),
      blocks: [{ kind: "cut", gi: 0, order: "shuffle" }, { kind: "cut", gi: 0, order: "seq" }, { kind: "summary", gi: 0, review: true }],
      bi: 0, stage: "", list: [], idx: 0, revealed: {}, listenMark: {}, cutMark: {}, result: {},
    };
    closeModal();
    enterBlock();
  }

  /* ---------------- 启动 ---------------- */
  try { if (window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } } catch (e) { /* ignore */ }
  S = loadState();
  if (ensureRoles()) saveState();
  render();
  renderLoginGate();
  renderStorageWarning();
  if (CLOUD_MODE) {
    if (!cloudToken()) { S.user = null; renderLoginGate(); }
    cloudPull().then(function (ok) {
      if (!ok) return;
      renderHeader();
      render();
      renderLoginGate();
    });
    setInterval(function () {
      if (cloudPushing || cloudTimer) return;
      cloudPull().then(function (ok) { if (ok) render(); });
    }, 20000);
  }
})();
