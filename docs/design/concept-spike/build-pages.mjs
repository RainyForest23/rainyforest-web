// Builds the Work pages of the concept spike from one list of experiences and one page template:
//   work/index.html                 every experience, with a link to its write-up and to its visual explanation if it has one
//   work/<slug>/index.html          the write-up: the same eight steps for every experience (spec §7.2)
// The visual explanation of an experience lives at work/<slug>/story/index.html and is built by its own script.
// Run: node build-pages.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/* ---- the experiences. tier: deep | standard | brief (brief has no page). story: has a visual explanation ---- */
export const EXPERIENCES = [
  { slug: "sdij-forest", lane: "Work", title: "SDIJ Forest Team", org: "Sidae Injae", role: "Project Lead and sole developer, 4-person team", when: "Feb 2023 – Jun 2025", tier: "deep", story: false,
    summary: "Internal tools for a university-entrance academy: student question classification, learning analytics, forum monitoring." },
  { slug: "hiconsy-lecture-asr", lane: "Work", title: "Hiconsy lecture ASR", org: "Hiconsy Inc.", role: "AI R&D Intern", when: "Jun 2025 – Jul 2026", tier: "deep", story: false,
    summary: "Korean lecture transcription. A token-handling fix cut insertion errors from 3,622 to 175 on one 107-minute lecture." },
  { slug: "energy-cost-model", lane: "Research", title: "Energy cost model for AI workloads", org: "Ewha Womans University", role: "Co-first author", when: "Sep 2025 – Jun 2026", tier: "standard", story: true,
    summary: "Splits a shared server's measured energy between the workloads on it, to within about 5 %." },
  { slug: "tesla-jr", lane: "Coursework", title: "Tesla Jr.", org: "Ewha Womans University, Intelligent Robotics", role: "One-person project", when: "May – Jun 2026", tier: "standard", story: true,
    summary: "A car-like robot that drives to a goal using only cameras and no map, in simulation." },
  { slug: null, lane: "Club", title: "GDGoC Ewha", org: "", role: "General Member, AI", when: "2025", tier: "brief", summary: "" },
  { slug: null, lane: "Awards", title: "Boeing Capstone Innovation Award, Grand Prize and Poster Excellence Award", org: "Ewha Womans University", role: "1st of 41", when: "Jun 2026", tier: "brief", summary: "" },
  { slug: null, lane: "Awards", title: "Ewha Startup Exploration Competition, Encouragement Award", org: "Ewha Womans University", role: "4th of 20", when: "Nov 2025", tier: "brief", summary: "" },
];

/* ---- the eight steps every write-up answers, in this order ---- */
const STEPS = [
  ["Decision", "Whose decision does this help?"],
  ["Before", "How was it done before, in numbers?"],
  ["Ontology", "What are the objects, how are they related, what can be done to them?"],
  ["Smallest version", "What was the smallest version that worked, and what were the sub-problems?"],
  ["Trade-offs", "What were the options, and why this one?"],
  ["What broke", "What failed, and how was it fixed?"],
  ["Measured", "What was the result, and how do we know?"],
  ["Next", "What is the next version?"],
];

const DRAFT = `<span class="draft" title="Written with AI from the paper and the public post. Not yet reviewed by the author.">[Draft]</span>`;
const p = (...lines) => lines.map((l) => `<p>${l}</p>`).join("");
const ul = (...items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const dl = (...pairs) => `<dl class="objects">${pairs.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join("")}</dl>`;

const ontologyMap = (() => {
  const box = (x, y, w, name, sub) => `<g><rect x="${x}" y="${y}" width="${w}" height="52"/><text class="n" x="${x + 12}" y="${y + 22}">${name}</text><text class="s" x="${x + 12}" y="${y + 39}">${sub}</text></g>`;
  const edge = (x1, y1, x2, y2, label, lx, ly) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="2.6"/><text class="e" x="${lx}" y="${ly}">${label}</text>`;
  return `<figure class="map"><svg viewBox="0 0 720 300" role="img" aria-label="Objects and relations: a server has parts, each part is read by a measurement over an interval; a workload runs on the server, is given an allocation and does some usage during the interval.">
${edge(170, 66, 290, 66, "has", 218, 58)}${edge(450, 66, 550, 66, "read by", 478, 58)}${edge(105, 196, 105, 100, "runs on", 114, 152)}
${edge(170, 212, 290, 178, "is given", 196, 184)}${edge(170, 232, 290, 262, "does", 214, 262)}${edge(450, 262, 550, 236, "during", 478, 262)}${edge(625, 100, 625, 196, "over", 634, 152)}
${box(40, 40, 130, "Server", "one machine")}${box(290, 40, 160, "Part", "CPU · GPU · memory · …")}${box(550, 40, 150, "Measurement", "wall · RAPL · NVML")}
${box(40, 200, 130, "Workload", "one tenant's program")}${box(290, 152, 160, "Allocation", "cores · memory · GPU share")}${box(290, 236, 160, "Usage", "CPU % · GPU % · bytes")}${box(550, 200, 150, "Interval", "the window counted")}
</svg><figcaption>Objects and how they relate. The split is an action on a part: it takes that part's energy for an interval and divides it across workloads by that part's rule.</figcaption></figure>`;
})();

const loopMap = (() => {
  const box = (x, y, w, name, sub) => `<g><rect x="${x}" y="${y}" width="${w}" height="52"/><text class="n" x="${x + 12}" y="${y + 22}">${name}</text><text class="s" x="${x + 12}" y="${y + 39}">${sub}</text></g>`;
  const edge = (x1, y1, x2, y2, label, lx, ly) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="2.6"/><text class="e" x="${lx}" y="${ly}">${label}</text>`;
  return `<figure class="map"><svg viewBox="0 0 720 300" role="img" aria-label="A loop: the camera gives points, points mark costmap cells, cells and the goal give a path, the path gives a command, the command is converted for the vehicle, and the vehicle's new pose changes what the camera sees.">
${edge(150, 66, 215, 66, "sees", 166, 58)}${edge(345, 66, 410, 66, "mark", 362, 58)}${edge(540, 66, 590, 66, "", 0, 0)}${edge(645, 92, 645, 196, "plan", 654, 150)}
${edge(590, 222, 540, 222, "follow", 546, 214)}${edge(410, 222, 345, 222, "convert", 352, 214)}${edge(215, 222, 150, 222, "", 0, 0)}${edge(95, 196, 95, 92, "moves", 104, 150)}
${box(40, 40, 110, "Camera", "3 stereo pairs")}${box(215, 40, 130, "Point", "where something is")}${box(410, 40, 130, "Costmap cell", "free or blocked")}${box(590, 40, 110, "Goal", "a place to reach")}
${box(590, 196, 110, "Path", "drivable curve")}${box(410, 196, 130, "Command", "speed, turn rate")}${box(215, 196, 130, "Steering, spin", "what a car has")}${box(40, 196, 110, "Vehicle", "pose on the floor")}
</svg><figcaption>One turn of the loop. It runs about 20 times a second, and nothing in it is a stored map.</figcaption></figure>`;
})();

const CONTENT = {
  "energy-cost-model": {
    title: "An energy cost model for AI workloads on shared servers",
    draft: { lead: true, from: "the paper and the public post", steps: [true, true, true, true, true, true, true, true] },   // set an entry to false once the author has reviewed or rewritten that part
    meta: [["Kind", "Research"], ["Where", "Ewha Womans University"], ["When", "Sep 2025 – Jun 2026, capstone and research"], ["Role", "Co-first author"], ["Built with", "Python, Intel RAPL, NVML, cgroup v2, a current clamp on the power cable"]],
    outcome: "A model that splits a shared server's measured energy between the workloads running on it. Checked against each workload measured alone, the split was within about 5 %. Published in <i>Mathematics</i> (MDPI, SCIE), 2026.",
    part: "Built the measurement stack, designed the split, and analysed the gap between billing by allocation and actual energy.",
    steps: [
      p("An operator runs many tenants' workloads on shared servers and has to decide what each one pays.",
        "Today the bill follows what was handed out: cores, memory, the type of GPU. This work supports a different decision: how much of a server's <b>energy</b> to charge to each workload when several run on it at once.",
        "The question matters now because energy has become a large part of what AI workloads cost to run."),
      p("Billing by allocation. Two workloads given the same 2 cores, 4 GB and 1 GPU pay the same.")
        + ul("Measured alone on that same slice, a ResNet workload drew 145 W above idle and a Node.js web server 14 W.",
          "Across the AI workloads tested, that is 4.8 to 10.5 times the web server.",
          "Run together in pairs, the gap was 4.7 to 11.0 times.")
        + p("Measuring each workload directly is not an option. Once two workloads share a machine, the meter at the wall gives one number for both.",
          "Earlier energy models mostly predict CPU power from how busy the CPU is. That leaves out the GPU, where AI workloads spend most of their energy, and it mishandles parts such as memory that draw power whether or not they are being used."),
      dl(["Server", "One physical machine. Its total energy is read at the wall."],
        ["Part", "CPU, GPU, memory, storage, and everything else (power supply loss, fans, the board). Each part has an idle energy and a measured energy."],
        ["Workload", "One tenant's program, running in its own slice of the server."],
        ["Allocation", "What a workload was given: cores, an amount of memory, a share of the GPU."],
        ["Usage", "What a workload did: how busy it kept the CPU and the GPU, how many bytes it read and wrote."],
        ["Interval", "The window of time over which energy is counted."],
        ["Measurement", "A reading of one part over one interval: the wall meter, the CPU's own energy counter (RAPL), the GPU's power interface (NVML), per-slice statistics (cgroup)."])
        + ontologyMap
        + p("Actions: <b>measure</b> a part, <b>split</b> a part's energy across workloads by that part's rule, <b>sum</b> the parts for each workload, and <b>check</b> that the workloads plus the machine's own baseline add up to the wall reading."),
      p("One idle server and one workload. Measure the server idle, run the workload alone, subtract.",
        "That gives each workload's own energy. Later it is the reference the split is checked against.")
        + `<ul class="tree"><li>Split a shared server's energy between workloads
            <ul><li>Measure the whole machine<ul><li>A current clamp on the power cable, logged every second</li></ul></li>
            <li>Measure each part<ul><li>CPU from its energy counter</li><li>GPU from its power interface</li></ul></li>
            <li>Tell workloads apart<ul><li>One slice each: 2 cores, 4 GB, 1 GPU</li></ul></li>
            <li>Split each part by its own rule<ul><li>CPU, GPU, memory, storage</li></ul></li>
            <li>Check the split<ul><li>Workloads + baseline = wall reading</li><li>Share under sharing vs the workload alone</li></ul></li></ul></li></ul>`
        + p("Then the full run: idle, each workload alone, and six pairs (three AI workloads each with the web server, and the three AI pairs). Every experiment was repeated five times and averaged."),
      dl(["CPU: by use", "Power is not strictly proportional to use when the chip changes frequency. Tracking frequency per workload would add monitoring cost, and frequency follows the total load rather than any one workload. So the measured CPU energy, minus idle, is split by how busy each workload kept it."],
        ["GPU: reserved, plus used", "A GPU draws power for being held, even with little to compute. Charging only by use would make that part nobody's. So the idle part follows the reservation and the rest follows use."],
        ["Memory: by amount held", "Memory power is mostly static. Charging by access would undercharge a workload that holds memory without touching it. So memory is charged by the amount held, at 0.2 W per GB."],
        ["One GPU per workload", "Each workload ran on its own GPU rather than a partitioned one. That gave clean GPU readings per workload without needing partitioning support. The cost: a GPU shared between workloads was not tested."],
        ["No extra instruments in the model", "The split uses only counters and statistics a server already exposes. It is coarser than instrumenting every component, and it can be deployed as it is."]),
      dl(["The wall reading looked flat", "In several runs the wall power stayed at the idle level whatever was running. The server's clock and the logger's clock had drifted apart, so the two logs were being lined up at the wrong moments. Fixed by keeping both in time sync."],
        ["The logger went quiet", "During the AI + AI pairs the wall logger stopped responding, so those wall readings are missing. They were approximated from the neighbouring intervals."],
        ["Two sets of numbers", "The paper reports runs at a fixed CPU frequency. The raw logs, averaged over six runs, give different absolute values: the web server's whole-system power is 64 W in the paper and 77.9 W in the raw average. Each number now says which condition it comes from."]),
      p("The check: take each workload's share when two run together, and compare it with the same workload measured alone.")
        + `<table><thead><tr><th>Pair</th><th>Error of the split</th></tr></thead><tbody>
            <tr><td>AI + web server</td><td>0.1–0.4 % for the AI workload, 0.4–4.1 % for the web server</td></tr>
            <tr><td>AI + AI, unequal energy</td><td>2.4–5.2 %, average 3.7 %</td></tr>
            <tr><td>AI + AI, similar energy</td><td>1.8–2.0 %</td></tr></tbody></table>`
        + p("The largest error was about 5 %. The web server's percentage looks larger than the AI workloads' because its energy is small, not because the miss in watts is bigger.",
          "With the same allocation, energy differed by 4.7 to 11.0 times in the AI + web server pairs, and by 2.2 and 2.4 times in two of the AI pairs."),
      ul("From slices to virtual machines, which is how tenants are actually separated.", "A billing model on top of the split.", "A GPU shared between workloads, which this experiment avoided.")
        + p("None of these is done yet."),
    ],
  },
  "tesla-jr": {
    title: "Tesla Jr.: a car that drives on cameras alone",
    draft: { lead: true, from: "the project's repository", steps: [true, true, true, true, true, true, true, true] },
    meta: [["Kind", "Course project"], ["Where", "Ewha Womans University, Intelligent Robotics, spring 2026"], ["When", "May – Jun 2026"], ["Role", "One-person project"], ["Built with", "Isaac Sim 4.2, ROS 2 Humble, Nav2 (Smac Hybrid-A*, MPPI), YOLOv8, Python"],
      ["Links", '<a href="https://github.com/RainyForest23/tesla-jr">Code</a> · <a href="https://youtu.be/XRJORmt7uws">Demo video</a>']],
    outcome: "A car-like robot that reaches a goal 11 m away, around two obstacles, using only cameras and no map. It runs in a simulator; the real car is the next step and is not done.",
    part: "Everything in the project: the simulation, the car model, the three nodes, the navigation set-up and the tests. As the repository says, an AI coding assistant helped with environment set-up, debugging and documentation.",
    steps: [
      p("The decision is a build decision: can a small car be driven with cameras only, or does it need a LiDAR and a map?",
        "It is my own decision, for the next step. A real ride-on car (a Henes Broon T870) is waiting for whatever works here, and cameras are the cheap option.",
        "So the question for the simulator was narrow: does a camera-only, map-free stack get a car-shaped vehicle to a goal past obstacles?"),
      p("The usual course project looks like this:")
        + ul("a two-wheel base that can turn on the spot,", "a LiDAR,", "a map made beforehand with SLAM,", "a stock robot in Gazebo.")
        + p("Each of those makes navigation easier. A car cannot turn on the spot, a camera gives depth only where it looks, and with no map there is nothing to plan on except what has been seen so far."),
      dl(["Vehicle", "Steers with its front wheels. Wheelbase 0.65 m, wheel radius 0.12 m, footprint 1.0 × 0.6 m, tightest turn 1.0 m."],
        ["Camera", "A stereo pair facing forward, later one more on each side, together covering about 180° ahead. Each gives a depth image."],
        ["Point", "A place where the camera saw something: 307,200 of them per frame, about 27 frames a second."],
        ["Costmap cell", "A small square of floor, free or blocked. The near map rolls along with the car; nothing is stored between runs."],
        ["Goal", "A position to reach, within a tolerance of 0.35 m."],
        ["Path", "A curve from the car to the goal that a car can actually follow."],
        ["Command", "A forward speed and a turn rate, sent many times a second."],
        ["Detection", "A person found in the camera image by YOLO."])
        + loopMap
        + p("Actions: <b>see</b> (camera to points), <b>mark</b> (points to cells), <b>plan</b> (cells and goal to path), <b>follow</b> (path to command), <b>convert</b> (command to steering angle and wheel speed), <b>stop</b> (a person ahead)."),
      p("The smallest version was not a car. It was the simulator's stock robot driven by keyboard, with one question: do camera images and points arrive on the other side at all?")
        + `<ul class="tree"><li>Drive a car to a goal on cameras alone
            <ul><li>Get data across<ul><li>Images at about 30 a second, points at about 27</li></ul></li>
            <li>See obstacles<ul><li>Points into costmap cells</li></ul></li>
            <li>Model the car<ul><li>My own T870 model, steering and drive joints</li></ul></li>
            <li>Turn commands into wheel motion<ul><li>The conversion node, which also reports the car's position</li></ul></li>
            <li>Plan for a car<ul><li>A planner and controller that do not ask it to spin</li></ul></li>
            <li>Check it<ul><li>A straight goal, then obstacles, a gate, a corner, a maze</li></ul></li></ul></li></ul>`
        + p("Only after the stock robot worked end to end was it swapped for the car."),
      dl(["Car steering, not a two-wheel base", "Harder to plan for, and the point of the project: the real vehicle is a car."],
        ["Cameras, no LiDAR", "Cheaper, and blind wherever no camera points. Side cameras were added for that; there is still none at the back."],
        ["No map", "Nothing to prepare and nothing to go stale. The cost is that the car only knows what it has seen, which is what stopped it in the maze."],
        ["Planner: the default, then Hybrid-A*", "The default planner asked for turns a car cannot make. Hybrid-A* plans with the car's turning circle."],
        ["Controller: three tries", "The default one turns on the spot. The second followed curves but hugged walls in a corner. The third (MPPI) checks the car's real outline and may reverse."],
        ["Depth from the simulator", "The depth image is the simulator's exact one, a stand-in for real stereo matching. It kept the project about navigation. It is also the largest gap to the real car."],
        ["One node owns the car", "Driving the wheels and reporting position are done by one node, because two programs holding the same simulated car broke each other."]),
      dl(["The floor looked like a wall", "Floor points were marked as obstacles: 2,243 of 6,400 cells. A goal 2 m away came back as a 14 m path and the car stood still. The floor appeared to rise with distance and crossed the 0.15 m line. Raising it to 0.35 m fixed it."],
        ["The wheels spun in place", "The rear wheels turned at the right speed and the car barely moved. The simulator had turned each round wheel into a rough many-sided shape. Giving the wheels a sphere to roll on fixed it."],
        ["Driving stopped when position reporting started", "Two scripts each took hold of the simulated car and cancelled each other's hold. They became one node."],
        ["Data that was listed but never arrived", "The two sides of the link used different versions of the same transport and failed silently over shared memory. Forcing plain network transport fixed it."],
        ["Points that would not show", "The points and the car's position were stamped by two different clocks. Everything was moved to one clock."]),
      p("All of this is in simulation.")
        + `<table><thead><tr><th>Test</th><th>Result</th></tr></thead><tbody>
            <tr><td>Goal 11 m ahead, two obstacles</td><td>Reached. Swerved 0.13 m right, then 0.12 m left, stopped at 10.81 m (tolerance 0.35 m)</td></tr>
            <tr><td>Posts outside the front camera's view</td><td>Passed, once the side cameras were added</td></tr>
            <tr><td>A 2.4 m wide corner</td><td>Driven without touching the walls</td></tr>
            <tr><td>A person ahead</td><td>Detected at 0.82 confidence, about 18 frames a second; the car stops and goes on</td></tr>
            <tr><td>A closed maze with four corners</td><td><b>Failed</b> after the first corner</td></tr></tbody></table>`
        + p("The maze is the honest limit. With no rear camera the car could not see the wall behind it when backing up. A fallback was added: if the car is told to move and does not, it assumes something is there and marks it. That stopped it from cheating around the outside, and did not get it through.",
          "The conclusion written down at the time: a maze like that needs a map."),
      ul("Real stereo matching in place of the simulator's depth.", "The same stack on the real car: a Jetson for the computing, motor drivers for steering and drive.", "A language model choosing the goal. The small node that accepts a goal as text is already there.")
        + p("None of these is done yet."),
    ],
  },
};

/* ---- page shell ---- */
const CSS = `
:root{--bg:#0a0f0d;--ink:#e6ebe4;--ink-2:#93a199;--ink-3:#5d6b64;--line:#1f2a25;--now:#72b98e;--snake:#e0b84c;
  --dot:#1a231f;--leaf-lo:#1d2f26;--leaf:#37604b;--leaf-hi:#5f9478;--bark-lo:#1f1c19;--bark-hi:#74695b;--rain:#a9c4b8;
  --font:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --step--1:clamp(.75rem,.72rem + .15vw,.84rem);--step-0:clamp(.97rem,.92rem + .22vw,1.08rem);--step-1:clamp(1.1rem,1rem + .5vw,1.4rem);--gutter:clamp(16px,4vw,48px)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:400 var(--step-0)/1.65 var(--font)}
a{color:inherit;text-underline-offset:.25em;text-decoration-style:dotted}
/* the forest stays behind the page: trees beside the text on wide screens, a band of canopy under the nav on narrow ones */
.forest{position:fixed;top:0;left:0;width:100%;pointer-events:none;z-index:0}.nav,main,footer{position:relative;z-index:1}
.nav{display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem 1.25rem;padding:1rem var(--gutter);font-size:var(--step--1)}
.nav .me{font-weight:600;text-decoration:none;margin-right:auto}.nav ul{display:flex;flex-wrap:wrap;gap:.25rem 1.1rem;list-style:none;margin:0;padding:0}
.nav ul a,.nav .lang{color:var(--ink-2);text-decoration:none}.nav ul a:hover,.nav ul a[aria-current],.nav .lang:hover{color:var(--ink)}
@media (max-width:40rem){.nav ul{order:3;flex-basis:100%;gap:.25rem .85rem}}
@media (max-width:69rem){.nav{padding-bottom:4.5rem}}   /* room for the band of canopy when there is no space for trees beside the text */
main{padding:clamp(1.5rem,4vw,3rem) var(--gutter) 4rem}.wrap{max-width:60rem;margin:0 auto}
.crumb{font:var(--step--1) var(--mono);color:var(--ink-3);margin:0 0 1.2rem}.crumb a{color:var(--ink-2);text-decoration:none}.crumb a:hover{color:var(--ink)}
h1{margin:0;font-size:clamp(1.8rem,1.2rem + 3vw,3.1rem);line-height:1.08;letter-spacing:-.03em;text-wrap:balance}
.lead{margin:1rem 0 0;max-width:44rem;color:var(--ink-2);font-size:var(--step-1);line-height:1.5}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.9rem 1.5rem;margin:1.8rem 0 0;padding:1rem 0;border-block:1px dotted var(--line)}
.meta dt{font:var(--step--1) var(--mono);color:var(--ink-3)}.meta dd{margin:.1rem 0 0;font-size:var(--step--1);color:var(--ink)}
.see{display:flex;flex-wrap:wrap;gap:.4rem 1.6rem;margin:1.2rem 0 0;font-size:var(--step--1)}
.see a{color:var(--ink)}.see .visual::before{content:"";display:inline-block;width:.5em;height:.5em;border-radius:50%;background:var(--snake);margin-right:.55em;vertical-align:.08em}
.soon{color:var(--ink-3)}
.draft{font:500 .72em/1 var(--mono);letter-spacing:.02em;color:var(--snake);white-space:nowrap;vertical-align:.12em;cursor:help}
.draft-note{margin:1rem 0 0;max-width:44rem;font-size:var(--step--1);color:var(--ink-3)}

/* write-up: a rail of the eight steps beside the text on wide screens */
.writeup{display:grid;grid-template-columns:minmax(0,1fr);gap:2rem;margin-top:clamp(2rem,5vw,3.5rem)}
.rail{display:none}
@media (min-width:62rem){.writeup{grid-template-columns:11rem minmax(0,44rem);gap:3rem}.rail{display:block;position:sticky;top:1.5rem;align-self:start}}
.rail ol{list-style:none;margin:0;padding:0;display:grid;gap:.55rem;font-size:var(--step--1)}
.rail a{display:flex;align-items:center;gap:.7rem;color:var(--ink-3);text-decoration:none}
.rail a::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;flex:none;transition:transform .2s}
.rail a:hover{color:var(--ink-2)}.rail a.on{color:var(--ink)}.rail a.on::before{background:var(--snake);transform:scale(1.7)}
.step{padding:0 0 clamp(2rem,4vw,3rem);margin:0 0 clamp(2rem,4vw,3rem);border-bottom:1px dotted var(--line);scroll-margin-top:1.5rem}
.step:last-of-type{border-bottom:0}
.step header{display:grid;grid-template-columns:auto 1fr;column-gap:.9rem;align-items:baseline;margin-bottom:1rem}
.step .no{font:var(--step--1) var(--mono);color:var(--snake)}
.step h2{margin:0;font-size:var(--step-1);font-weight:600;letter-spacing:-.01em}
.step .ask{grid-column:2;margin:.15rem 0 0;font-size:var(--step--1);color:var(--ink-3)}
.step p{margin:0 0 .8em;max-width:42rem}.step p:last-child{margin-bottom:0}.step b{font-weight:600}
.step ul{margin:0 0 .9em;padding-left:1.1rem;max-width:42rem}.step li{margin:.3em 0}.step li::marker{color:var(--ink-3)}
.empty{color:var(--ink-2);max-width:42rem}
.objects{margin:0 0 1rem;display:grid;gap:.75rem}.objects div{display:grid;grid-template-columns:minmax(0,1fr);gap:.1rem}
@media (min-width:44rem){.objects div{grid-template-columns:11.5rem minmax(0,1fr);gap:1rem}}
.objects dt{font-weight:600}.objects dd{margin:0;color:var(--ink-2)}
.map{margin:1.4rem 0;display:none}@media (min-width:44rem){.map{display:block}}
.map svg{width:100%;height:auto;display:block}
.map rect{fill:var(--bg);stroke:var(--ink-3);stroke-dasharray:1.5 3;stroke-linecap:round}
.map line{stroke:var(--ink-3);stroke-dasharray:1.5 4;stroke-linecap:round}.map circle{fill:var(--ink-2)}
.map text{font-family:var(--font);fill:var(--ink)}.map .n{font-size:14px;font-weight:600}.map .s{font-size:11px;fill:var(--ink-2)}.map .e{font:11px var(--mono);fill:var(--ink-3)}
.map figcaption{margin-top:.6rem;font-size:var(--step--1);color:var(--ink-3);max-width:42rem}
.tree,.tree ul{list-style:none;margin:0;padding:0}.tree{margin:1rem 0 1.1rem}
.tree ul{margin-left:.45rem;padding-left:1.1rem;border-left:1px dotted var(--ink-3)}
.tree li{margin:.35rem 0;position:relative}.tree ul>li::before{content:"";position:absolute;left:-1.1rem;top:.85em;width:.8rem;border-top:1px dotted var(--ink-3)}
.tree>li{font-weight:600}.tree>li>ul>li{font-weight:400}.tree ul ul li{color:var(--ink-2);font-size:var(--step--1)}
table{border-collapse:collapse;margin:.4rem 0 1rem;width:100%;max-width:42rem;font-size:var(--step--1)}
th,td{text-align:left;padding:.55rem .8rem .55rem 0;border-bottom:1px dotted var(--line);vertical-align:top}th{color:var(--ink-3);font-weight:500}
.now{margin:1.2rem 0 0;padding:.9rem 1rem;border-left:2px dotted var(--now);background:#0e1512;font-size:var(--step--1);color:var(--ink-2)}
.now strong{display:block;font:var(--step--1) var(--mono);color:var(--now);margin-bottom:.3rem;font-weight:500}
.next{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.6rem 2rem;margin-top:2.5rem;padding-top:1.2rem;border-top:1px dotted var(--line);font-size:var(--step--1)}

/* work index */
.lane{margin-top:clamp(2rem,5vw,3rem)}.lane h2{margin:0 0 .4rem;font:var(--step--1) var(--mono);color:var(--ink-3);font-weight:500}
.row{display:grid;grid-template-columns:minmax(0,1fr);gap:.2rem;padding:1rem 0;border-top:1px dotted var(--line)}
@media (min-width:48rem){.row{grid-template-columns:9rem minmax(0,1fr) auto;gap:1.5rem;align-items:baseline}}
.row .when{font:var(--step--1) var(--mono);color:var(--ink-3)}
.row h3{margin:0;font-size:var(--step-1);font-weight:600;letter-spacing:-.01em}.row h3 a{text-decoration:none}.row h3 a:hover{text-decoration:underline dotted}
.row .who{margin:.1rem 0 0;font-size:var(--step--1);color:var(--ink-2)}.row .sum{margin:.4rem 0 0;color:var(--ink-2);max-width:40rem}
.row .see{margin:.5rem 0 0}@media (min-width:48rem){.row .see{margin:0;flex-direction:column;align-items:flex-end;gap:.3rem}}
footer{padding:1.5rem var(--gutter) 3rem;color:var(--ink-3);font-size:var(--step--1)}
`;

/* ---- sections that are not built yet: each gets the "under construction" page ---- */
const SOON = [
  ["study", "Study", "Notes from what I am studying, with code you can run in the page."],
  ["principles", "Principles", "The rules I work by, each traced to where it came from and where it was used."],
  ["keynotes", "Keynotes", "Talks, playable in the page."],
  ["blog", "Blog", "Older posts, moving over from the previous site."],
];
const nav = (root, current) => `<nav class="nav" aria-label="Site"><a class="me" href="${root}index.html">Rainyforest</a><ul>
<li><a href="${root}work/index.html"${current === "work" ? ' aria-current="page"' : ""}>Work</a></li>${SOON.map(([slug, name]) => `<li><a href="${root}${slug}/index.html"${current === slug ? ' aria-current="page"' : ""}>${name}</a></li>`).join("")}<li><a href="#">CV</a></li>
</ul><a class="lang" href="#" lang="ko">한국어</a></nav>`;
const soonPage = ([slug, name, what]) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name} — Rainyforest</title><style>${CSS}
:root{--floor-lo:#18211d;--floor-hi:#2c3b34;--snake-2:#8a6a22;--snake-hi:#f3dd92;--tongue:#d2654e}
html,body{height:100%}body{overflow:hidden}.soon{position:fixed;inset:0;width:100%;height:100%;z-index:0}
main.soon-main{padding:clamp(2.5rem,9vh,6rem) var(--gutter) 0}
.soon-text{width:fit-content;max-width:min(30rem,62%)}@media (min-width:45rem){.soon-text{max-width:min(30rem,52%)}}   /* the tree stands to the right of the words */
.soon-text .kicker{margin:0 0 .5rem;font:var(--step--1) var(--mono);color:var(--snake);letter-spacing:.12em;text-transform:uppercase}
.soon-text h1{font-size:clamp(2rem,1.3rem + 3.6vw,3.6rem)}
.soon-text p{margin:1rem 0 0;color:var(--ink-2);text-wrap:pretty}
.soon-text .links{display:flex;flex-wrap:wrap;gap:.4rem 1.5rem;margin-top:1.4rem;font-size:var(--step--1)}.soon-text .links a{color:var(--ink)}
</style></head><body>
<canvas class="soon" aria-hidden="true"></canvas>
${nav("../", slug)}<main class="soon-main"><div class="soon-text"><p class="kicker">${name}</p><h1>Under construction</h1>
<p>${what}</p><p>Not built yet. The snake is on it.</p>
<p class="links"><a href="../work/index.html">See the work →</a><a href="../index.html">Home</a></p></div></main>
<script src="../soon.js"></script></body></html>`;
const shell = ({ root, title, body, script = "", rain = "none" }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Rainyforest</title><style>${CSS}</style></head><body>
<canvas class="forest" aria-hidden="true" data-rain="${rain}"></canvas>
${nav(root, "work")}${body}<footer>A preview. The site is still being built.</footer><script src="${root}forest.js"></script>${script ? `<script>${script}</script>` : ""}</body></html>`;
const out = (path, html) => { mkdirSync(dirname(join(HERE, path)), { recursive: true }); writeFileSync(join(HERE, path), html); console.log("wrote", path); };

/* ---- where a click on an experience goes: the visual explanation if there is one, otherwise the write-up ---- */
export const hrefOf = (e, root) => (e.slug ? `${root}work/${e.slug}/${e.story ? "story/" : ""}index.html` : null);

for (const section of SOON) out(`${section[0]}/index.html`, soonPage(section));

/* ---- work index ---- */
const lanes = [...new Set(EXPERIENCES.map((e) => e.lane))];
out("work/index.html", shell({ root: "../", title: "Work", rain: "sides", body: `<main><div class="wrap">
<h1>Work</h1><p class="lead">Every experience on the timeline. The ones with a dot have a visual explanation; all of them with a page are written up in the same eight steps.</p>
${lanes.map((lane) => `<section class="lane"><h2>${lane}</h2>${EXPERIENCES.filter((e) => e.lane === lane).map((e) => `<article class="row"><span class="when">${e.when}</span><div>
<h3>${e.slug ? `<a href="${hrefOf(e, "../")}">${e.title}</a>` : e.title}</h3><p class="who">${[e.org, e.role].filter(Boolean).join(" · ")}</p>${e.summary ? `<p class="sum">${e.summary}</p>` : ""}</div>
${e.slug ? `<p class="see">${e.story ? `<a class="visual" href="${e.slug}/story/index.html">Visual explanation →</a>` : ""}<a href="${e.slug}/index.html">Write-up →</a></p>` : `<p class="see soon">One line only</p>`}</article>`).join("")}</section>`).join("")}
</div></main>` }));

/* ---- write-ups ---- */
const railScript = `const links=[...document.querySelectorAll('.rail a')];
const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting)links.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id))},{rootMargin:'-20% 0px -65% 0px'});
document.querySelectorAll('.step').forEach(s=>io.observe(s));`;
const paged = EXPERIENCES.filter((e) => e.slug);
paged.forEach((e, i) => {
  const c = CONTENT[e.slug], id = (n) => `step-${n + 1}`, nextE = paged[(i + 1) % paged.length];
  const meta = c ? c.meta : [["Kind", e.lane], ["Where", e.org], ["When", e.when], ["Role", e.role]];
  out(`work/${e.slug}/index.html`, shell({ root: "../../", title: e.title, script: railScript, body: `<main><div class="wrap">
<p class="crumb"><a href="../index.html">Work</a> / ${e.lane}</p>
<h1>${c ? c.title : e.title}</h1>
<p class="lead">${c ? c.outcome : e.summary}${c && c.draft && c.draft.lead ? " " + DRAFT : ""}</p>
<dl class="meta">${meta.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join("")}</dl>
<p class="see">${e.story ? `<a class="visual" href="story/index.html">Visual explanation →</a>` : `<span class="soon">Visual explanation: ${e.tier === "deep" ? "planned" : "none"}</span>`}</p>
${c && c.draft ? `<p class="draft-note">${DRAFT} marks text written with AI from ${c.draft.from}. The author has not reviewed it yet; the tag comes off a section once they have.</p>` : ""}
${c ? "" : `<div class="writeup"><div><p class="empty">This write-up is in progress. It will answer the same eight questions as the others: ${STEPS.map(([name]) => name).join(", ")}.</p>
<p class="next"><a href="../index.html">← All work</a><a href="../${nextE.slug}/${nextE.story ? "story/" : ""}index.html">Next: ${nextE.title} →</a></p></div></div>`}
${!c ? "" : `<div class="writeup"><nav class="rail" aria-label="Steps"><ol>${STEPS.map(([name], n) => `<li><a href="#${id(n)}">${name}</a></li>`).join("")}</ol></nav>
<div>${STEPS.map(([name, ask], n) => `<section class="step" id="${id(n)}"><header><span class="no">${String(n + 1).padStart(2, "0")}</span><h2>${name}${c && c.draft && c.draft.steps[n] ? " " + DRAFT : ""}</h2><p class="ask">${ask}</p></header>
${c.steps[n]}</section>`).join("")}
${c.part ? `<p class="who" style="color:var(--ink-2);font-size:var(--step--1)"><b style="color:var(--ink)">My part.</b> ${c.part}</p>` : ""}
${c.now ? `<aside class="now"><strong>Re-decomposed on ${c.now.date}</strong>${c.now.text}</aside>` : ""}
<p class="next"><a href="../index.html">← All work</a><a href="../${nextE.slug}/${nextE.story ? "story/" : ""}index.html">Next: ${nextE.title} →</a></p>
</div></div>`}</div></main>` }));
});
