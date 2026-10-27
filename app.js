
const API = "https://api.alquran.cloud/v1";

const state = {
  surahs: [],
  activeSurah: 1,
  latin: true,
  translation: true,
  requestId: 0
};

const elements = {
  surahList: document.getElementById("surahList"),
  search: document.getElementById("surahSearch"),
  surahName: document.getElementById("surahName"),
  surahTranslation: document.getElementById("surahTranslation"),
  surahMeta: document.getElementById("surahMeta"),
  surahArabicName: document.getElementById("surahArabicName"),
  ayahList: document.getElementById("ayahList"),
  audio: document.getElementById("quranAudio"),
  showLatin: document.getElementById("showLatin"),
  showTranslation: document.getElementById("showTranslation"),
  prev: document.getElementById("prevSurah"),
  next: document.getElementById("nextSurah"),
  menuToggle: document.getElementById("menuToggle"),
  navLinks: document.getElementById("navLinks")
};

document.getElementById("year").textContent = new Date().getFullYear();

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Permintaan gagal: ${response.status}`);
  }

  const result = await response.json();

  if (result.code && result.code !== 200) {
    throw new Error(result.status || "Data tidak tersedia.");
  }

  return result.data;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function showError(container, message) {
  container.innerHTML = `
    <p class="loading">${escapeHTML(message)}</p>
    <button class="btn btn-secondary" id="retryButton" type="button">
      Coba Lagi
    </button>
  `;

  const retryButton = container.querySelector("#retryButton");

  if (retryButton) {
    retryButton.addEventListener("click", () => {
      if (container === elements.surahList) {
        loadSurahs();
      } else {
        loadSurah(state.activeSurah);
      }
    });
  }
}

async function loadSurahs() {
  elements.surahList.innerHTML =
    '<p class="loading">Memuat daftar surah...</p>';

  try {
    state.surahs = await fetchJSON(`${API}/surah`);
    renderSurahList();
    await loadSurah(state.activeSurah);
  } catch (error) {
    console.error(error);
    showError(
      elements.surahList,
      "Daftar surah belum dapat dimuat. Periksa koneksi internet."
    );
  }
}

function renderSurahList() {
  const query = elements.search.value.trim().toLowerCase();

  const filtered = state.surahs.filter(surah => {
    const name = surah.englishName || "";
    const translation = surah.englishNameTranslation || "";
    const arabic = surah.name || "";
    const number = String(surah.number);

    return (
      name.toLowerCase().includes(query) ||
      translation.toLowerCase().includes(query) ||
      arabic.includes(query) ||
      number === query
    );
  });

  if (!filtered.length) {
    elements.surahList.innerHTML =
      '<p class="loading">Surah tidak ditemukan.</p>';
    return;
  }

  elements.surahList.innerHTML = filtered.map(surah => `
    <button
      type="button"
      class="surah-item ${surah.number === state.activeSurah ? "active" : ""}"
      data-surah="${surah.number}"
      aria-current="${surah.number === state.activeSurah ? "true" : "false"}"
    >
      <span class="surah-number">${surah.number}</span>
      <span class="surah-item-info">
        <strong>${escapeHTML(surah.englishName)}</strong>
        <small>${escapeHTML(surah.englishNameTranslation)}</small>
      </span>
      <span class="surah-item-arabic">${escapeHTML(surah.name)}</span>
    </button>
  `).join("");

  elements.surahList.querySelectorAll("[data-surah]").forEach(button => {
    button.addEventListener("click", () => {
      loadSurah(Number(button.dataset.surah));
    });
  });
}

async function loadSurah(number) {
  const requestId = ++state.requestId;
  state.activeSurah = number;

  renderSurahList();

  elements.ayahList.innerHTML =
    '<p class="loading">Memuat ayat, latin, dan terjemahan...</p>';

  elements.surahName.textContent = "Memuat...";
  elements.surahTranslation.textContent = "Mohon tunggu";
  elements.surahArabicName.textContent = "";
  elements.surahMeta.textContent = `SURAH ${number}`;

  elements.audio.pause();
  elements.audio.removeAttribute("src");
  elements.audio.load();

  try {
    const [arabic, translation, transliteration] = await Promise.all([
      fetchJSON(`${API}/surah/${number}/quran-uthmani`),
      fetchJSON(`${API}/surah/${number}/id.indonesian`),
      fetchJSON(`${API}/surah/${number}/en.transliteration`)
    ]);

    if (requestId !== state.requestId) return;

    elements.surahName.textContent = arabic.englishName;
    elements.surahTranslation.textContent =
      arabic.englishNameTranslation;
    elements.surahArabicName.textContent = arabic.name;
    elements.surahMeta.textContent =
      `${arabic.revelationType === "Meccan" ? "MAKKIYAH" : "MADANIYAH"} · ` +
      `${arabic.numberOfAyahs} AYAT`;

    const audioURL =
      `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${number}.mp3`;

    elements.audio.src = audioURL;
    elements.audio.load();

    renderAyahs(
      arabic.ayahs,
      translation.ayahs,
      transliteration.ayahs
    );

    elements.prev.disabled = number <= 1;
    elements.next.disabled = number >= 114;

    elements.prev.style.opacity = number <= 1 ? ".45" : "1";
    elements.next.style.opacity = number >= 114 ? ".45" : "1";
  } catch (error) {
    console.error(error);

    if (requestId !== state.requestId) return;

    showError(
      elements.ayahList,
      "Ayat belum dapat dimuat. Coba lagi atau periksa koneksi internet."
    );
  }
}

function renderAyahs(arabicAyahs, translationAyahs, latinAyahs) {
  elements.ayahList.innerHTML = arabicAyahs.map((ayah, index) => {
    const translation = translationAyahs[index]?.text || "";
    const latin = latinAyahs[index]?.text || "";

    return `
      <article class="ayah-card">
        <div class="ayah-top">
          <span class="ayah-number">${ayah.numberInSurah}</span>
          <span class="eyebrow">AYAT ${ayah.numberInSurah}</span>
        </div>

        <p class="ayah-arabic" lang="ar" dir="rtl">
          ${escapeHTML(ayah.text)}
        </p>

        <p class="ayah-latin" ${state.latin ? "" : "hidden"}>
          ${escapeHTML(latin)}
        </p>

        <p class="ayah-translation" ${state.translation ? "" : "hidden"}>
          ${escapeHTML(translation)}
        </p>
      </article>
    `;
  }).join("");
}

elements.search.addEventListener("input", renderSurahList);

elements.showLatin.addEventListener("change", event => {
  state.latin = event.target.checked;

  elements.ayahList.querySelectorAll(".ayah-latin").forEach(item => {
    item.hidden = !state.latin;
  });
});

elements.showTranslation.addEventListener("change", event => {
  state.translation = event.target.checked;

  elements.ayahList.querySelectorAll(".ayah-translation").forEach(item => {
    item.hidden = !state.translation;
  });
});

elements.prev.addEventListener("click", () => {
  if (state.activeSurah > 1) {
    loadSurah(state.activeSurah - 1);
    document.getElementById("quran").scrollIntoView({ behavior: "smooth" });
  }
});

elements.next.addEventListener("click", () => {
  if (state.activeSurah < 114) {
    loadSurah(state.activeSurah + 1);
    document.getElementById("quran").scrollIntoView({ behavior: "smooth" });
  }
});

elements.menuToggle.addEventListener("click", () => {
  const isOpen = elements.navLinks.classList.toggle("open");
  elements.menuToggle.setAttribute("aria-expanded", String(isOpen));
  elements.menuToggle.textContent = isOpen ? "✕" : "☰";
});

elements.navLinks.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    elements.navLinks.classList.remove("open");
    elements.menuToggle.setAttribute("aria-expanded", "false");
    elements.menuToggle.textContent = "☰";
  });
});

loadSurahs();
