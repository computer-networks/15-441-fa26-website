(() => {
  const output = document.querySelector("#upcoming-due");
  const now = new Date();
  const rows = [...document.querySelectorAll("#due-list tr[data-due], #due-list tr[data-due-date]")];
  const entries = rows
    .map((row) => ({
      row,
      date: new Date(row.dataset.due || `${row.dataset.dueDate}T23:59:59`),
      dateOnly: Boolean(row.dataset.dueDate),
    }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.date - b.date);
  const firstUpcoming = entries.findIndex(({ date }) => date >= now);
  const visibleStart = firstUpcoming === -1
    ? Math.max(0, entries.length - 3)
    : Math.min(firstUpcoming, Math.max(0, entries.length - 3));
  const visibleEnd = Math.min(entries.length, visibleStart + 3);
  const past = entries.slice(0, visibleStart);
  const later = entries.slice(visibleEnd);

  const addFoldControl = (buttonId, items, label) => {
    const button = document.querySelector(buttonId);
    if (!button || !items.length) return;
    let expanded = false;
    items.forEach(({ row }) => row.classList.add("due-collapsed"));
    const update = () => {
      button.textContent = `${expanded ? "Hide" : "Show"} ${items.length} ${label} deadline${items.length === 1 ? "" : "s"}`;
      button.setAttribute("aria-expanded", String(expanded));
    };
    button.hidden = false;
    button.addEventListener("click", () => {
      expanded = !expanded;
      items.forEach(({ row }) => row.classList.toggle("due-collapsed", !expanded));
      update();
    });
    update();
  };
  addFoldControl("#toggle-past-due", past, "past");
  addFoldControl("#toggle-later-due", later, "later");

  const upcoming = firstUpcoming === -1 ? null : entries[firstUpcoming];

  if (!upcoming) {
    output.textContent = "No upcoming deadlines announced.";
    return;
  }

  upcoming.row.classList.add("current-due");
  upcoming.row.setAttribute("aria-current", "true");
  const name = upcoming.row.cells[0].textContent.trim();
  const options = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  if (!upcoming.dateOnly) Object.assign(options, {
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  const formatted = new Intl.DateTimeFormat("en-US", options).format(upcoming.date);
  output.textContent = `${name} — ${formatted}`;
})();

(() => {
  const CALENDAR_ID = "c_01998bef9eb226de431cf07ac279abffa1c364aac4f4445af6af59cc1e959201@group.calendar.google.com";
  const TIME_ZONE = "America/New_York";
  const CACHE_KEY = "course-calendar-week-v1";
  const CACHE_TTL = 10 * 60 * 1000;
  const CALENDAR_START_MINUTES = 9 * 60;
  const CALENDAR_END_MINUTES = 18 * 60;
  const CALENDAR_RANGE_MINUTES = CALENDAR_END_MINUTES - CALENDAR_START_MINUTES;
  const apiKey = window.COURSE_CALENDAR_API_KEY;
  const calendar = document.querySelector("#api-calendar");
  if (!calendar || !apiKey) return;

  const dateKey = (date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const todayParts = dateKey(new Date()).split("-").map(Number);
  const todayUtc = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]));
  const weekday = todayUtc.getUTCDay();
  let mondayUtc = new Date(todayUtc);
  mondayUtc.setUTCDate(todayUtc.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  let dates;
  let saturdayUtc;
  const setWeekDates = () => {
    dates = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(mondayUtc);
      date.setUTCDate(mondayUtc.getUTCDate() + index);
      return date;
    });
    saturdayUtc = new Date(mondayUtc);
    saturdayUtc.setUTCDate(mondayUtc.getUTCDate() + 5);
  };
  setWeekDates();

  const etOffset = (date) => {
    const zone = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "shortOffset" })
      .formatToParts(date).find((part) => part.type === "timeZoneName").value;
    const match = zone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    const sign = match[1] === "+" ? "+" : "-";
    return `${sign}${match[2].padStart(2, "0")}:${match[3] || "00"}`;
  };
  const boundary = (date) => `${date.toISOString().slice(0, 10)}T00:00:00${etOffset(new Date(`${date.toISOString().slice(0, 10)}T12:00:00Z`))}`;

  const endpointForWeek = () => {
    const params = new URLSearchParams({
      timeMin: boundary(mondayUtc),
      timeMax: boundary(saturdayUtc),
      timeZone: TIME_ZONE,
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
    });
    return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;
  };

  const eventParts = (value) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(value));
    return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  };

  const updateCurrentTimeMarker = () => {
    document.querySelectorAll(".calendar-now").forEach((marker) => marker.remove());
    const now = new Date();
    const parts = eventParts(now);
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    if (minutes < CALENDAR_START_MINUTES || minutes > CALENDAR_END_MINUTES) return;
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    const column = document.querySelector(`.calendar-day-column[data-date="${key}"]`);
    if (!column) return;
    const marker = document.createElement("div");
    marker.className = "calendar-now";
    marker.style.top = `${(minutes - CALENDAR_START_MINUTES) / CALENDAR_RANGE_MINUTES * 100}%`;
    column.append(marker);
  };

  const render = (events) => {
    const head = document.querySelector("#calendar-head");
    const body = document.querySelector("#calendar-body");
    head.replaceChildren();
    body.replaceChildren();
    const corner = document.createElement("div");
    corner.textContent = "Time";
    head.append(corner);
    dates.forEach((date) => {
      const item = document.createElement("div");
      item.innerHTML = `<strong>${date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</strong><span>${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>`;
      if (date.toISOString().slice(0, 10) === dateKey(new Date())) item.classList.add("today");
      head.append(item);
    });
    const times = document.createElement("div");
    times.className = "calendar-times";
    for (let hour = 9; hour <= 18; hour += 1) {
      const label = document.createElement("span");
      label.textContent = new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", { hour: "numeric" });
      label.style.top = `${(hour * 60 - CALENDAR_START_MINUTES) / CALENDAR_RANGE_MINUTES * 100}%`;
      times.append(label);
    }
    body.append(times);
    dates.forEach((date) => {
      const column = document.createElement("div");
      column.className = "calendar-day-column";
      const key = date.toISOString().slice(0, 10);
      column.dataset.date = key;
      events.filter((event) => event.start?.dateTime && event.end?.dateTime).forEach((event) => {
        const start = eventParts(event.start.dateTime);
        const end = eventParts(event.end.dateTime);
        if (`${start.year}-${start.month}-${start.day}` !== key) return;
        const startMinutes = Number(start.hour) * 60 + Number(start.minute);
        const endMinutes = Number(end.hour) * 60 + Number(end.minute);
        if (endMinutes <= CALENDAR_START_MINUTES || startMinutes >= CALENDAR_END_MINUTES) return;
        const block = document.createElement("div");
        block.className = "calendar-event";
        block.style.top = `${Math.max(0, startMinutes - CALENDAR_START_MINUTES) / CALENDAR_RANGE_MINUTES * 100}%`;
        block.style.height = `${Math.max(4, (Math.min(CALENDAR_END_MINUTES, endMinutes) - Math.max(CALENDAR_START_MINUTES, startMinutes)) / CALENDAR_RANGE_MINUTES * 100)}%`;
        const title = document.createElement("strong");
        title.textContent = event.summary || "Course event";
        const time = document.createElement("span");
        const timeFormat = { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" };
        const startTime = new Date(event.start.dateTime).toLocaleTimeString("en-US", timeFormat);
        const endTime = new Date(event.end.dateTime).toLocaleTimeString("en-US", timeFormat);
        time.className = "event-time";
        time.textContent = `${startTime}–${endTime}`;
        block.append(title, time);
        const details = [event.summary || "Course event", `${startTime}–${endTime}`];
        if (event.location) {
          const location = document.createElement("span");
          location.className = "event-location";
          location.textContent = event.location;
          block.append(location);
          details.push(event.location);
        }
        block.tabIndex = 0;
        block.title = details.join("\n");
        block.setAttribute("aria-label", details.join(", "));
        column.append(block);
      });
      body.append(column);
    });
    updateCurrentTimeMarker();
    calendar.hidden = false;
    document.querySelector("#calendar-fallback").hidden = true;
    document.querySelector("#calendar-navigation").hidden = false;
    document.querySelector("#add-calendar").hidden = false;
  };

  const load = async () => {
    setWeekDates();
    const weekCacheKey = `${CACHE_KEY}-${mondayUtc.toISOString().slice(0, 10)}`;
    let cached;
    try { cached = JSON.parse(localStorage.getItem(weekCacheKey)); } catch { cached = null; }
    if (cached && Date.now() - cached.savedAt < CACHE_TTL) {
      render(cached.events);
      return;
    }
    try {
      const response = await fetch(endpointForWeek(), { headers: { "x-goog-api-key": apiKey } });
      if (!response.ok) throw new Error(`Calendar API returned ${response.status}`);
      const data = await response.json();
      localStorage.setItem(weekCacheKey, JSON.stringify({ savedAt: Date.now(), events: data.items || [] }));
      render(data.items || []);
    } catch (error) {
      if (cached?.events) render(cached.events);
      console.warn(error);
    }
  };
  document.querySelector("#previous-week").addEventListener("click", () => {
    mondayUtc.setUTCDate(mondayUtc.getUTCDate() - 7);
    load();
  });
  document.querySelector("#next-week").addEventListener("click", () => {
    mondayUtc.setUTCDate(mondayUtc.getUTCDate() + 7);
    load();
  });
  setInterval(updateCurrentTimeMarker, 60 * 1000);
  load();
})();
