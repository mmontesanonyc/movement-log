// --------------------
// STATE
// --------------------
let weekOffset = 0; // 0 = most recent 4 weeks, -1 = 4 weeks before that, etc.
let allRows = [];

// --------------------
// FETCH + INIT
// --------------------
const trackerURL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBUFreWSuNQf5WjF3kZuS4kViTkppPcPgk3a1yOwXJJGcozdl8r2-aEDy7Ev10YoQsOb47dszCYTpl/pub?gid=0&single=true&output=csv";

fetch(trackerURL)
  .then((r) => r.text())
  .then((csv) => {
    allRows = parseCSV(csv);
    renderNav();
    buildCalendar(allRows, weekOffset);
  });

// --------------------
// NAV CONTROLS
// --------------------
function renderNav() {
  const existing = document.getElementById("cal-nav");
  if (existing) existing.remove();

  const { start, end } = getWindowDates(weekOffset);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const nav = document.createElement("div");
  nav.id = "cal-nav";
  nav.style.cssText =
    "display:flex;align-items:center;gap:12px;margin-bottom:1rem;";

  const prev = document.createElement("button");
  prev.classList.add('btn', 'btn-outline-primary');
  prev.textContent = "← Prev";
  prev.onclick = () => { weekOffset--; renderNav(); buildCalendar(allRows, weekOffset); };

  const label = document.createElement("span");
  label.style.cssText = "flex:1;text-align:center;font-weight:500;";
  label.textContent = fmt(start) + " – " + fmt(end);

  const next = document.createElement("button");
  next.classList.add('btn', 'btn-outline-primary');

  next.textContent = "Next →";
  next.disabled = weekOffset === 0;
  next.onclick = () => { weekOffset++; renderNav(); buildCalendar(allRows, weekOffset); };

  nav.append(prev, label, next);

  // Insert nav before the calendar div
  const calendar = document.getElementById("calendar");
  calendar.parentNode.insertBefore(nav, calendar);
}

// --------------------
// WINDOW CALCULATION
// --------------------
// Returns the Monday–Sunday(+3 weeks) window for a given offset.
// offset 0  = most recent 4 weeks ending this Sunday
// offset -1 = the 4 weeks before that, etc.
function getWindowDates(offset) {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // Mon=0 … Sun=6

  // most recent Monday on or before today
  const thisMon = new Date(today);
  thisMon.setDate(today.getDate() - dow);
  thisMon.setHours(0, 0, 0, 0);

  // shift by offset windows (each window = 28 days)
  const start = new Date(thisMon);
  start.setDate(thisMon.getDate() + offset * 28);

  const end = new Date(start);
  end.setDate(start.getDate() + 27); // +27 days = 4 full weeks

  return { start, end };
}

// --------------------
// BUILD CALENDAR  (now windowed)
// --------------------
function buildCalendar(rows, offset) {
  const calendar = document.getElementById("calendar");
  const grouped = groupByDate(rows);
  const { start, end } = getWindowDates(offset);

  calendar.innerHTML = "";
  calendar.className = "calendar";

  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) => {
    const h = document.createElement("div");
    h.className = "calendar-header";
    h.textContent = d;
    calendar.appendChild(h);
  });

  let d = new Date(start);
  while (d <= end) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "calendar-day";

    const iso = toISODate(d);

    const num = document.createElement("div");
    num.className = "date-number";
    num.textContent = d.getDate();
    dayDiv.appendChild(num);

    if (grouped[iso]) {
      grouped[iso].forEach((item) => {
        const a = document.createElement("div");

        let activityClass = "activity";
        if (item.Done) {
          const doneValue = item.Done.toLowerCase();
          if (doneValue === "yes" && item.Activity !== "Rest")
            activityClass += " done";
          else if (doneValue === "no") activityClass += " missed";
          else if (doneValue === "yes" && item.Activity === "Rest")
            activityClass += " rest";
        }

        a.className = activityClass;

        const icon = item.Activity.includes("Ride")
          ? '<i class="fas fa-biking"></i> '
          : item.Activity === "Gym"
          ? '<i class="fas fa-dumbbell"></i> '
          : item.Activity === "Core/weight"
          ? '<i class="fas fa-universal-access"></i> '
          : item.Activity === "Other"
          ? '<i class="fas fa-walking"></i>'
          : "";

        const notes = (item.Notes || "")
          .replace(/;\s*/g, "<br>")
          .replace(/\|/g, ": ");

        a.innerHTML = `
          <strong>${icon}${item.Activity}</strong>
          ${item.Time ? `<hr>${item.Time}` : ""}
          ${notes ? `<hr>${notes}` : ""}
        `;

        dayDiv.appendChild(a);
      });
    }

    calendar.appendChild(dayDiv);
    d.setDate(d.getDate() + 1);
  }
}

// --------------------
// All your existing helpers stay unchanged below:
// parseCSV, parseUSDate, toISODate, groupByDate
// --------------------

// REAL CSV PARSER (handles quotes & commas)
// --------------------
function parseCSV(csv) {
  const rows = [];
  let current = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];

    if (c === '"') {
      insideQuotes = !insideQuotes;
    } else if (c === "," && !insideQuotes) {
      current.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !insideQuotes) {
      if (value || current.length) {
        current.push(value);
        rows.push(current);
      }
      current = [];
      value = "";
    } else {
      value += c;
    }
  }

  if (value || current.length) {
    current.push(value);
    rows.push(current);
  }

  const headers = rows[0];

  return rows
    .slice(1)
    .filter((r) => r.length === headers.length)
    .map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h.trim()] = r[i].trim();
      });
      return obj;
    });
}



// DATE HELPERS (M/D/YY)
// --------------------
function parseUSDate(s) {
  if (!s) return NaN;

  const [m, d, y] = s.split("/");
  if (!m || !d || !y) return NaN;

  const year = y.length === 2 ? Number("20" + y) : Number(y);
  return new Date(year, Number(m) - 1, Number(d));
}

function toISODate(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}


// GROUP BY DATE
// --------------------
function groupByDate(rows) {
  const map = {};

  rows.forEach((r) => {
    const d = parseUSDate(r.Date);
    if (isNaN(d)) return;

    const iso = toISODate(d);
    if (!map[iso]) map[iso] = [];
    map[iso].push(r);
  });

  return map;
}


// DATE RANGE
// --------------------
function getDateRange(rows) {
  const dates = rows
    .map((r) => parseUSDate(r.Date))
    .filter((d) => !isNaN(d));

  if (!dates.length) return null;

  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));

  // Monday-based index (Mon = 0, Sun = 6)
  const minOffset = (min.getDay() + 6) % 7;
  const maxOffset = (max.getDay() + 6) % 7;

  // move min back to Monday
  min.setDate(min.getDate() - minOffset);

  // move max forward to Sunday
  max.setDate(max.getDate() + (6 - maxOffset));

  return { min, max };
}