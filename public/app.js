const initialClips = Array.from({ length: 128 }, (_, index) => ({
  id: index + 1,
  title: index < 100 ? "Spam elsisyy" : ["Best Stream Moments", "Funny Stream Highlight", "Ranked Match Win", "Community Moments"][index % 4],
  date: new Date(Date.now() - index * 3600000).toLocaleDateString(),
  duration: ["00:24", "00:38", "01:12", "00:51"][index % 4]
}));

let clips = [...initialClips];
let selected = new Set();
let visibleCount = 8;

const $ = (id) => document.getElementById(id);
const clipList = $("clipList");
const searchInput = $("searchInput");
const filterSelect = $("filterSelect");

function filteredClips() {
  const query = searchInput.value.trim().toLowerCase();
  return clips.filter((clip) => {
    const matchesQuery = clip.title.toLowerCase().includes(query);
    const isSpam = clip.title.toLowerCase().includes("spam elsisyy");
    const matchesFilter = filterSelect.value === "all" || (filterSelect.value === "spam" && isSpam) || (filterSelect.value === "other" && !isSpam);
    return matchesQuery && matchesFilter;
  });
}

function render() {
  const filtered = filteredClips();
  const shown = filtered.slice(0, visibleCount);
  clipList.innerHTML = "";

  if (!shown.length) {
    clipList.innerHTML = '<div class="empty-state">No clips match your search.</div>';
  } else {
    for (const clip of shown) {
      const isSelected = selected.has(clip.id);
      const spam = clip.title.toLowerCase().includes("spam elsisyy");
      const row = document.createElement("label");
      row.className = `clip-row ${isSelected ? "selected" : ""}`;
      row.innerHTML = `
        <input type="checkbox" data-id="${clip.id}" ${isSelected ? "checked" : ""} aria-label="Select ${escapeHtml(clip.title)}">
        <div class="clip-thumb">▶</div>
        <div class="clip-info"><div class="clip-title"></div><div class="clip-meta">Clip #${clip.id} · ${clip.date} · ${clip.duration}</div></div>
        <span class="clip-tag ${spam ? "" : "other"}">${spam ? "SPAM MATCH" : "CLIP"}</span>`;
      row.querySelector(".clip-title").textContent = clip.title;
      row.querySelector("input").addEventListener("change", (event) => {
        event.target.checked ? selected.add(clip.id) : selected.delete(clip.id);
        render();
      });
      clipList.appendChild(row);
    }
  }

  $("totalStat").textContent = clips.length;
  $("selectedStat").textContent = selected.size;
  $("spamStat").textContent = clips.filter(c => c.title.toLowerCase().includes("spam elsisyy")).length;
  $("selectionCount").textContent = selected.size;
  $("deleteCount").textContent = selected.size ? `(${selected.size})` : "";
  $("deleteBtn").disabled = selected.size === 0;
  $("resultsText").textContent = `Showing ${shown.length} of ${filtered.length} matching clips`;
  $("selectAllBtn").textContent = shown.length && shown.every(c => selected.has(c.id)) ? "☑ Deselect shown" : "□ Select all shown";
  $("loadMoreBtn").style.display = filtered.length > visibleCount ? "inline-block" : "none";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

$("selectAllBtn").addEventListener("click", () => {
  const shown = filteredClips().slice(0, visibleCount);
  const allShownSelected = shown.length && shown.every(c => selected.has(c.id));
  shown.forEach(c => allShownSelected ? selected.delete(c.id) : selected.add(c.id));
  render();
});

$("clearBtn").addEventListener("click", () => { selected.clear(); render(); });
searchInput.addEventListener("input", () => { visibleCount = 8; render(); });
filterSelect.addEventListener("change", () => { visibleCount = 8; render(); });
$("loadMoreBtn").addEventListener("click", () => { visibleCount += 8; render(); });
$("refreshBtn").addEventListener("click", () => { toast("Demo data refreshed."); });
$("connectBtn").addEventListener("click", () => toast("Kick OAuth integration is not configured yet."));
$("closeNotice").addEventListener("click", () => document.querySelector(".notice").remove());
$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));

$("deleteBtn").addEventListener("click", () => {
  if (!selected.size) return;
  $("confirmText").textContent = `You selected ${selected.size} sample clips. This action only removes them from this demo page.`;
  $("confirmDialog").showModal();
});
$("cancelDelete").addEventListener("click", () => $("confirmDialog").close());
$("confirmDelete").addEventListener("click", () => {
  const count = selected.size;
  clips = clips.filter(clip => !selected.has(clip.id));
  selected.clear();
  $("confirmDialog").close();
  render();
  toast(`${count} demo clips removed from this preview.`);
});

render();