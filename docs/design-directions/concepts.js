(() => {
  "use strict";

  const isStudio = document.body.dataset.direction === "studio";
  const rooms = [
    { id: "living", name: "Living room", area: 24, use: "Relaxing, reading & everyday life", prompt: "Where does everyday life happen?", choices: ["Reading corner", "TV & music", "Occasional home office"], checked: [0, 1], reviewed: false },
    { id: "kitchen", name: "Kitchen", area: 12, use: "Cooking & gathering", prompt: "How do you want to use this room?", choices: ["Everyday cooking", "Coffee corner", "Eating together"], checked: [0, 2], reviewed: false },
    { id: "bedroom", name: "Bedroom", area: 16, use: "Rest & quiet routines", prompt: "What belongs in your evening routine?", choices: ["Bedside reading", "Dressing area", "Quiet workspace"], checked: [0], reviewed: true },
    { id: "bathroom", name: "Bathroom", area: 6, use: "Daily routines", prompt: "What should your electrician know?", choices: ["Morning routine", "Shared by the family", "Storage to discuss"], checked: [0, 1], reviewed: true },
    { id: "hall", name: "Hallway", area: 6, use: "Arriving & leaving home", prompt: "What makes coming home easier?", choices: ["Coat storage", "Cleaning cupboard", "A place for keys"], checked: [0, 2], reviewed: true },
  ];
  let selected = "living";
  rooms.forEach((room) => { room.note = ""; });

  const icon = `<svg class="brand-mark" aria-hidden="true" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="9"/><circle cx="18" cy="18" r="9"/><path d="M14 16v4m8-4v4M18 8v3m0 14v3"/></svg>`;
  const arrow = `<span aria-hidden="true">↗</span>`;
  const steps = `<nav class="steps" aria-label="Demonstration steps">
    <button type="button" id="source-toggle" aria-expanded="false" aria-controls="source-info"><span class="step-number">✓</span> Sample plan</button>
    <span class="current-step" aria-current="step"><span class="step-number">2</span> Review rooms</span>
    <span><span class="step-number">3</span> Preview pack</span>
  </nav>`;
  const roomList = `<nav class="room-list" aria-label="Select a room">${rooms.map((room, index) => `
    <button type="button" data-room="${room.id}" class="room-option" aria-pressed="${room.id === selected}">
      <span class="room-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="room-option-text"><strong>${room.name}</strong><span>${room.area} m² <span data-room-status="${room.id}">${room.reviewed ? "· Reviewed" : "· To review"}</span></span></span>
      <span class="room-check" data-check="${room.id}" aria-hidden="true">${room.reviewed ? "✓" : "○"}</span>
    </button>`).join("")}</nav>`;
  const floorPlan = `<figure class="plan-figure">
    <div class="plan-toolbar"><div><span class="eyebrow">Your sample home</span><h2>The everyday apartment</h2></div><span class="plan-area">64 m² <span>· 5 rooms</span></span></div>
    <div class="drawing" id="drawing">
      <svg class="floor-plan" viewBox="0 0 800 560" aria-hidden="true">
        <defs><pattern id="floor-lines" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 0H28" class="floor-line"/></pattern></defs>
        <rect class="room-fill" data-fill="living" x="44" y="34" width="380" height="274"/>
        <rect class="room-fill" data-fill="kitchen" x="434" y="34" width="320" height="274"/>
        <rect class="room-fill" data-fill="bedroom" x="44" y="318" width="280" height="172"/>
        <rect class="room-fill" data-fill="hall" x="334" y="318" width="220" height="172"/>
        <rect class="room-fill" data-fill="bathroom" x="564" y="318" width="190" height="172"/>
        <rect x="44" y="34" width="710" height="456" fill="url(#floor-lines)"/>
        <g class="furniture">
          <rect x="73" y="68" width="166" height="50" rx="8"/><path d="M82 115v-36h147v36m-99-36v33m51-33v33"/>
          <rect x="99" y="144" width="109" height="42" rx="19"/>
          <rect x="357" y="61" width="39" height="118" rx="3"/>
          <circle cx="85" cy="267" r="16"/><path d="m75 256 19 22m-16 1 13-24"/>
          <path d="M460 63h266v48H508v103h-48z"/>
          <rect x="549" y="73" width="42" height="26" rx="4"/>
          <rect x="613" y="194" width="83" height="59" rx="16"/><path d="M602 200v45m105-45v45"/>
          <rect x="76" y="342" width="111" height="120" rx="6"/><path d="M76 378h111m-56 0v84"/>
          <rect x="83" y="350" width="44" height="22" rx="5"/><rect x="136" y="350" width="44" height="22" rx="5"/>
          <rect x="265" y="342" width="33" height="117" rx="2"/>
          <rect x="367" y="448" width="132" height="21" rx="2"/>
          <rect x="686" y="341" width="46" height="124" rx="17"/><rect x="586" y="344" width="55" height="34" rx="8"/>
        </g>
        <g class="walls"><path d="M44 34H754V490H44Z"/><path d="M429 34V229m0 51v33M44 313H240m58 0h312m56 0h88M329 313v74m0 55v48M559 313v81m0 53v43"/></g>
        <g class="windows"><path d="M99 34h190m219 0h174M44 363v87M120 490h118"/></g>
        <g class="doors"><path d="M429 229h51a51 51 0 0 1-51 51m-189 33v58a58 58 0 0 0 58-58m312 0v56a56 56 0 0 0 56-56m-337 74h-55a55 55 0 0 0 55 55m230-48h-53a53 53 0 0 0 53 53"/></g>
        <path class="entrance" d="M423 528v-23m-6 6 6-6 6 6"/>
        <text class="entrance-label" x="438" y="527">Entrance</text>
      </svg>
      <div class="plan-rooms" role="group" aria-label="Illustrative floor plan, not to scale">
        ${rooms.map((room) => `<button type="button" data-room="${room.id}" class="plan-room ${room.id}" aria-pressed="${room.id === selected}" aria-label="${room.name}, ${room.area} square metres"><span class="plan-room-label"><strong>${room.name}</strong><span>${room.area} m²</span></span></button>`).join("")}
      </div>
    </div>
    <figcaption><span class="legend"><i aria-hidden="true"></i> Selected room</span><span>Illustration only · Not to scale</span></figcaption>
    <div class="drawing-note"><span aria-hidden="true">↖</span> Choose a room to tell us how you’ll use it.</div>
  </figure>`;
  const inspector = `<aside class="inspector" aria-labelledby="room-heading">
    <div class="inspector-top"><span class="eyebrow">Room details</span><span class="status-label" id="detail-status">To review</span></div>
    <h2 id="room-heading" tabindex="-1">Living room</h2>
    <p class="room-meta" id="room-meta">24 m² · Relaxing, reading &amp; everyday life</p>
    <fieldset id="room-options"><legend id="room-prompt"></legend><div id="choices"></div></fieldset>
    <label class="note-label" for="room-note">A note for the conversation <span>(optional)</span></label>
    <textarea id="room-note" rows="2" maxlength="180" placeholder="Try: We’re keeping the reading chair." aria-describedby="note-help"></textarea>
    <p class="field-help" id="note-help">Use fictional details. Notes stay in this tab and disappear on reload.</p>
    <button type="button" class="secondary-button" id="mark-reviewed">Mark room reviewed <span aria-hidden="true">✓</span></button>
    <p class="inspector-foot">Your routines first. Your electrician checks the electrical decisions.</p>
  </aside>`;

  document.getElementById("app").innerHTML = `
    <a class="skip-link" href="#main">Skip to room review</a>
    <div class="concept-bar"><span><b>Concept ${isStudio ? "A" : "B"}</b> · ${isStudio ? "The planning studio" : "The spatial workbench"} <span class="approval">— direction not yet approved</span></span><a href="${isStudio ? "workbench" : "studio"}.html">View ${isStudio ? "B: workbench" : "A: studio"} ${arrow}</a></div>
    <header class="app-header"><a href="index.html" class="brand" aria-label="Rosette concept chooser">${icon}<span>rosette</span></a>${steps}<span class="demo-tag">Sample project · Demo</span></header>
    <section id="source-info" class="source-info" hidden aria-label="Sample plan information">
      <strong>No upload needed for this demonstration.</strong>
      <p>An original, fictional 64 m² apartment with five rooms. Both visual directions use the same plan. No real property, files, AI analysis, or electrical calculations are involved.</p>
      <button type="button" class="text-button" id="source-close">Continue room review →</button>
    </section>
    <main id="main" tabindex="-1">
      <div id="review-screen">
        <section class="intro">
          <div><p class="eyebrow">${isStudio ? "A little planning. A more considered home." : "Sample apartment / Room review"}</p><h1>${isStudio ? "Make room for<br><em>the way you live.</em>" : "Your home, room by room."}</h1></div>
          <div class="intro-note"><p>${isStudio ? "Before the renovation begins, put your everyday routines on the plan." : "Select a room on the plan. Check its details and describe what matters to you."}</p><span>Fictional apartment · Latvia · 64 m²</span></div>
        </section>
        <div class="workspace">
          <section class="room-navigation" aria-label="Sample rooms"><div class="room-navigation-heading"><h2>Your rooms</h2><span>5 total</span></div>${roomList}</section>
          ${floorPlan}${inspector}
        </div>
        <section class="review-bar" aria-label="Review progress and next step"><div><div class="progress-heading"><strong id="review-count"></strong><span id="remaining-count"></span></div><div class="progress-track" role="progressbar" aria-label="Rooms reviewed" aria-valuemin="0" aria-valuemax="5" aria-valuenow="3"><span id="progress-fill"></span></div></div><div class="review-action"><span>No electrical calculations in this demo</span><button type="button" class="primary-button" id="preview-pack">Preview review pack ${arrow}</button></div></section>
      </div>
      <section id="pack-screen" class="pack-screen" hidden aria-labelledby="pack-heading">
        <button type="button" class="text-button" id="back-review">← Back to room review</button>
        <div class="pack-heading"><p class="eyebrow">Demonstration / Homeowner’s brief</p><h1 id="pack-heading" tabindex="-1">A starting point<br>for the conversation.</h1><p>Your sample room preferences, together in one place.</p></div>
        <div class="pack-notice"><strong>Not an approved electrical design.</strong><p>This is a demonstration planning aid for electrician review. It contains no socket positions, wiring instructions, standards checks, or installation specification.</p></div>
        <p id="pack-status" class="pack-status"></p>
        <div id="pack-rooms" class="pack-rooms"></div>
        <p class="pack-end">Nothing was calculated, uploaded, sent, or downloaded. Reloading resets this demonstration.</p>
      </section>
      <p class="safety-note"><strong>Planning aid for electrician review.</strong> Demonstration only — not an approved electrical design.</p>
    </main>
    <footer class="page-footer"><span>Rosette · Design exploration</span><span>Original sample drawing. No personal data. No backend.</span></footer>
    <div class="sr-only" role="status" aria-live="polite" id="announcement"></div>`;

  const currentRoom = () => rooms.find((room) => room.id === selected);
  const announce = (text) => { document.getElementById("announcement").textContent = text; };

  function updateProgress() {
    const count = rooms.filter((room) => room.reviewed).length;
    document.getElementById("review-count").textContent = `${count} of 5 rooms reviewed`;
    document.getElementById("remaining-count").textContent = count === 5 ? "Ready to preview" : `${5 - count} still to check`;
    document.getElementById("progress-fill").style.width = `${count * 20}%`;
    document.querySelector('[role="progressbar"]').setAttribute("aria-valuenow", String(count));
    document.querySelector('[role="progressbar"]').setAttribute("aria-valuetext", `${count} of 5 rooms reviewed`);
    rooms.forEach((room) => {
      document.querySelector(`[data-room-status="${room.id}"]`).textContent = room.reviewed ? "· Reviewed" : "· To review";
      document.querySelector(`[data-check="${room.id}"]`).textContent = room.reviewed ? "✓" : "○";
      document.querySelectorAll(`[data-room="${room.id}"]`).forEach((button) => {
        button.setAttribute("aria-label", `${room.name}, ${room.area} square metres, ${room.reviewed ? "reviewed" : "to review"}`);
      });
    });
    document.getElementById("detail-status").textContent = currentRoom().reviewed ? "Reviewed" : "To review";
    document.getElementById("mark-reviewed").innerHTML = currentRoom().reviewed ? 'Reopen room review <span aria-hidden="true">↺</span>' : 'Mark room reviewed <span aria-hidden="true">✓</span>';
  }

  function showRoom(id, shouldAnnounce = true) {
    selected = id;
    const room = currentRoom();
    document.querySelectorAll("[data-room]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.room === id)));
    document.querySelectorAll("[data-fill]").forEach((shape) => shape.classList.toggle("selected", shape.dataset.fill === id));
    document.getElementById("room-heading").textContent = room.name;
    document.getElementById("room-meta").textContent = `${room.area} m² · ${room.use}`;
    document.getElementById("room-prompt").textContent = room.prompt;
    document.getElementById("choices").innerHTML = room.choices.map((choice, index) => `<label class="choice"><input type="checkbox" value="${index}" ${room.checked.includes(index) ? "checked" : ""}><span>${choice}</span></label>`).join("");
    document.getElementById("room-note").value = room.note;
    updateProgress();
    if (shouldAnnounce) announce(`${room.name} selected. ${room.reviewed ? "Reviewed." : "To review."} Room details updated below.`);
  }

  document.querySelectorAll("[data-room]").forEach((button) => {
    button.addEventListener("click", () => {
      showRoom(button.dataset.room);
      // On small screens, move directly to the selected room rather than leaving
      // its changed details several screens below the user's current position.
      if (window.matchMedia("(max-width: 760px)").matches) {
        document.getElementById("room-heading").focus({ preventScroll: true });
        document.querySelector(".inspector").scrollIntoView({ block: "start" });
      }
    });
  });
  document.getElementById("choices").addEventListener("change", () => {
    const room = currentRoom();
    room.checked = Array.from(document.querySelectorAll("#choices input:checked"), (input) => Number(input.value));
    room.reviewed = false;
    updateProgress();
    announce(`${room.name} preferences updated. Mark the room reviewed when ready.`);
  });
  document.getElementById("room-note").addEventListener("input", (event) => {
    currentRoom().note = event.target.value;
    currentRoom().reviewed = false;
    updateProgress();
  });
  document.getElementById("mark-reviewed").addEventListener("click", () => {
    currentRoom().reviewed = !currentRoom().reviewed;
    updateProgress();
    announce(`${currentRoom().name} ${currentRoom().reviewed ? "marked reviewed" : "reopened for review"}. ${document.getElementById("review-count").textContent}.`);
  });

  const sourceToggle = document.getElementById("source-toggle");
  sourceToggle.addEventListener("click", () => {
    const open = sourceToggle.getAttribute("aria-expanded") !== "true";
    document.getElementById("source-info").hidden = !open;
    sourceToggle.setAttribute("aria-expanded", String(open));
  });
  document.getElementById("source-close").addEventListener("click", () => {
    document.getElementById("source-info").hidden = true;
    sourceToggle.setAttribute("aria-expanded", "false");
    sourceToggle.focus();
  });

  document.getElementById("preview-pack").addEventListener("click", () => {
    const count = rooms.filter((room) => room.reviewed).length;
    document.getElementById("pack-status").textContent = count === 5
      ? "All 5 sample rooms reviewed. Electrical decisions still require a qualified electrician."
      : `${5 - count} room${5 - count === 1 ? "" : "s"} still to review. This preview includes incomplete room notes.`;
    const packRooms = document.getElementById("pack-rooms");
    packRooms.replaceChildren();
    rooms.forEach((room) => {
      const article = document.createElement("article");
      const heading = document.createElement("h2");
      const status = document.createElement("span");
      const preferences = document.createElement("p");
      const note = document.createElement("p");
      heading.textContent = `${room.name} · ${room.area} m²`;
      status.className = "status-label";
      status.textContent = room.reviewed ? "Reviewed" : "To review";
      preferences.textContent = room.checked.length ? room.checked.map((index) => room.choices[index]).join(" · ") : "No routines selected.";
      note.className = "pack-note";
      note.textContent = room.note ? `Sample note: ${room.note}` : "No additional note.";
      article.append(heading, status, preferences, note);
      packRooms.append(article);
    });
    document.getElementById("review-screen").hidden = true;
    document.getElementById("pack-screen").hidden = false;
    document.querySelector(".current-step").removeAttribute("aria-current");
    document.querySelector(".steps > :last-child").setAttribute("aria-current", "step");
    document.getElementById("pack-heading").focus();
    window.scrollTo(0, 0);
  });
  document.getElementById("back-review").addEventListener("click", () => {
    document.getElementById("pack-screen").hidden = true;
    document.getElementById("review-screen").hidden = false;
    document.querySelector(".current-step").setAttribute("aria-current", "step");
    document.querySelector(".steps > :last-child").removeAttribute("aria-current");
    document.getElementById("preview-pack").focus();
  });
  showRoom("living", false);
})();
