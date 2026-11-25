// Builds the Work pages of the concept spike from one list of experiences and one page template:
//   work/index.html                 every experience, with a link to its write-up and to its visual explanation if it has one
//   work/<slug>/index.html          the write-up: the same eight steps for every experience (spec §7.2)
// The visual explanation of an experience lives at work/<slug>/story/index.html and is built by its own script.
// Run: node build-pages.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  { slug: "tesla-jr", lane: "Project", title: "Tesla Jr.", org: "Ewha Womans University, Intelligent Robotics", role: "One-person project", when: "May – Jun 2026", tier: "standard", story: true,
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
        ["Points that would not show", "The points and the car's position were stamped by two different clocks. Everything was moved to one clock."],
        ["It kept reversing into a wall", "The cameras look forward, left and right. Backing out of a dead end, the car could not see the wall behind it and went on reversing into it. A virtual bumper fixed that: if the car is told to move and has not moved for a second, the place 0.7 m that way is marked as an obstacle, like anything a camera saw, and the wheels stop."]),
      p("All of this is in simulation.")
        + `<table><thead><tr><th>Test</th><th>Result</th></tr></thead><tbody>
            <tr><td>Goal 11 m ahead, two obstacles</td><td>Reached. Swerved 0.13 m right, then 0.12 m left, stopped at 10.81 m (tolerance 0.35 m)</td></tr>
            <tr><td>Posts outside the front camera's view</td><td>Passed, once the side cameras were added</td></tr>
            <tr><td>A 2.4 m wide corner</td><td>Driven without touching the walls</td></tr>
            <tr><td>A person ahead</td><td>Detected at 0.82 confidence, about 18 frames a second; the car stops and goes on</td></tr>
            <tr><td>A closed maze with four corners</td><td><b>Failed</b> after the first corner</td></tr></tbody></table>`
        + p("The maze is the honest limit. The virtual bumper stopped the endless reversing and stopped the car from cheating around the outside of the maze. It did not get it through.",
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
.see a{color:var(--ink)}.see .visual::before{content:"";display:inline-block;width:.5em;height:.6em;background:var(--now);clip-path:polygon(0 0,100% 50%,0 100%);margin-right:.5em}
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
  ["blog", "Blog", "Older posts, moving over from the previous site."],
];
const MENU = [...SOON.slice(0, 2), ["keynotes", "Keynotes"], ...SOON.slice(2)];   // menu order: Study, Principles, Keynotes, Blog
const nav = (root, current) => `<nav class="nav" aria-label="Site"><a class="me" href="${root}index.html">Rainyforest</a><ul>
<li><a href="${root}work/index.html"${current === "work" ? ' aria-current="page"' : ""}>Experience</a></li>${MENU.map(([slug, name]) => `<li><a href="${root}${slug}/index.html"${current === slug ? ' aria-current="page"' : ""}>${name}</a></li>`).join("")}<li><a href="#">CV</a></li>
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
<p class="links"><a href="../work/index.html">See the experience →</a><a href="../index.html">Home</a></p></div></main>
<script src="../soon.js"></script></body></html>`;
const shell = ({ root, title, body, script = "", rain = "none" }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Rainyforest</title><style>${CSS}</style></head><body>
<canvas class="forest" aria-hidden="true" data-rain="${rain}"></canvas>
${nav(root, "work")}${body}<footer>A preview. The site is still being built.</footer><script src="${root}forest.js"></script>${script ? `<script>${script}</script>` : ""}</body></html>`;
const out = (path, html) => { mkdirSync(dirname(join(HERE, path)), { recursive: true }); writeFileSync(join(HERE, path), html); console.log("wrote", path); };

/* ---- where a click on an experience goes: the visual explanation if there is one, otherwise the write-up ---- */
export const hrefOf = (e, root) => (e.slug ? `${root}work/${e.slug}/${e.story ? "story/" : ""}index.html` : null);

for (const section of SOON) out(`${section[0]}/index.html`, soonPage(section));

/* ---- Keynotes: an outdoor cinema in the forest. The deck plays on a screen held between two posts;
        the caption for each animation step sits under the screen, between the posts, never on it.
        If the deck has been prepared from Keynote's HTML export (keynotes/prepare-deck.mjs) it plays with its
        builds and transitions; otherwise the page falls back to one still image per slide ---- */
const DECK = { slug: "tesla-jr", title: "Tesla Jr.", where: "Intelligent Robotics, Jun 2026", stills: 15 };
const deckDir = join(HERE, "keynotes", DECK.slug), LIVE = existsSync(join(deckDir, "deck", "index.html"));
const DECK_STEPS = LIVE ? JSON.parse(readFileSync(join(deckDir, "deck.json"), "utf8")).steps : DECK.stills;
const CAPTIONS = LIVE ? JSON.parse(readFileSync(join(deckDir, "captions.json"), "utf8")) : {};   // one caption per animation step, keyed by step number; written by the author
out("keynotes/index.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Keynotes — Rainyforest</title><style>${CSS}
:root{--floor-lo:#18211d;--floor-hi:#2c3b34;--snake-2:#8a6a22;--snake-hi:#f3dd92}
body{position:relative;min-height:100svh;display:flex;flex-direction:column}
.rig{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
.cinema-main{flex:1;padding:0 var(--gutter) 6.5rem}
.cinema{width:100%;max-width:max(18rem,calc((100svh - 21rem) * 16 / 9));margin:0 auto}
.bill{margin:.2rem 0 .8rem;font:var(--step--1) var(--mono);color:var(--ink-3);text-align:center}.bill b{color:var(--ink);font-weight:600}
.screen{position:relative;aspect-ratio:16/9;background:#000;cursor:pointer}
.screen img,.screen iframe{display:block;width:100%;height:100%;border:0;object-fit:contain}
.under{padding:.9rem 1rem 0;min-height:8rem;display:grid;grid-template-rows:1fr auto;gap:.4rem}
.caption{margin:0 auto;width:100%;max-width:46rem;min-height:4.4rem;display:flex;align-items:center;justify-content:center;text-align:center;font-size:var(--step-1);line-height:1.4}
.caption.empty{font:var(--step--1) var(--mono);color:var(--ink-3)}
@media (min-width:60rem){.cinema{max-width:max(18rem,min(calc((100svh - 21rem) * 16 / 9),calc(100vw - 20rem)))}}   /* always leave room for the trees */
.reel{display:flex;justify-content:center;align-items:center;gap:1.1rem;font:var(--step--1) var(--mono);color:var(--ink-2)}
.reel button{background:none;border:0;color:var(--ink);font:inherit;cursor:pointer;padding:.3rem .6rem}.reel button:disabled{color:var(--ink-3);cursor:default}
.reel .hint{color:var(--ink-3)}@media (max-width:40rem){.reel .hint{display:none}}
</style></head><body>
<canvas class="forest" aria-hidden="true" data-rain="sides" data-column=".cinema"></canvas>
<canvas class="rig" aria-hidden="true"></canvas>
${nav("../", "keynotes")}<main class="cinema-main"><div class="cinema">
<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Keynotes</h1>
<p class="bill">Now showing · <b>${DECK.title}</b> · ${DECK.where}</p>
<div class="screen">${LIVE
  ? `<iframe src="${DECK.slug}/deck/index.html" title="${DECK.title}: slide deck with its animations. Click it or press the right arrow for the next step." allow="fullscreen"></iframe>`
  : `<img alt="" src="${DECK.slug}/01.jpg">`}</div>
<div class="under"><p class="caption" aria-live="polite"></p>
<div class="reel"><button type="button" data-go="-1" aria-label="Previous step">←</button><span class="count"></span><button type="button" data-go="1" aria-label="Next step">→</button><span class="hint">click the screen, or press →</span></div></div>
</div></main>
<script src="../forest.js"></script>
<script>
(() => {   // the deck
  const LIVE = ${LIVE}, CAP = ${JSON.stringify(CAPTIONS)}, slug = "${DECK.slug}";
  const screen = document.querySelector(".screen"), cap = document.querySelector(".caption"), count = document.querySelector(".count"), [prev, next] = document.querySelectorAll(".reel button");
  let at = 1, of = ${DECK_STEPS};
  function show() {
    const text = (CAP[at] || "").trim();
    cap.textContent = text || (LIVE ? "caption for step " + at : "");                 // captions are still to be written
    cap.classList.toggle("empty", !text);
    count.textContent = at + " / " + of; prev.disabled = at <= 1; next.disabled = at >= of;
  }
  let go;
  if (LIVE) {      // Keynote's own player runs in the frame. It says which step it is on, and moves when asked (see prepare-deck.mjs)
    const frame = screen.querySelector("iframe");
    addEventListener("message", (e) => { if (e.source === frame.contentWindow && e.data && e.data.keynote === "step") { at = e.data.step; of = e.data.of; show(); } });
    go = (d) => frame.contentWindow.postMessage(d > 0 ? "keynote:next" : "keynote:prev", "*");
  } else {         // stills: one image per slide
    const img = screen.querySelector("img"), src = (i) => slug + "/" + String(i).padStart(2, "0") + ".jpg";
    go = (d) => { at = Math.min(of, Math.max(1, at + d)); img.src = src(at); img.alt = "Slide " + at + " of " + of; show(); };
    screen.addEventListener("click", (e) => { const b = screen.getBoundingClientRect(); go(e.clientX - b.left < b.width / 2 ? -1 : 1); });
  }
  prev.onclick = () => go(-1); next.onclick = () => go(1);
  addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); } });
  show();
})();
(() => {   // the rig, in the same dot grid as the forest: two posts holding the screen, the forest floor, a row of log seats, and one of the audience
  const cv = document.querySelector("canvas.rig"), ctx = cv.getContext("2d"), css = getComputedStyle(document.documentElement);
  const hex = (n) => { const h = css.getPropertyValue(n).trim().slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const mix = (a, b, t) => "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t)))).join(",") + ")";
  const K = { bg: hex("--bg"), bark: [hex("--bark-lo"), hex("--bark-hi")], floor: [hex("--floor-lo"), hex("--floor-hi")], snake: hex("--snake"), band: hex("--snake-2"), hi: hex("--snake-hi") };
  const noise = (c, r) => { let h = Math.imul(c | 0, 374761393) ^ Math.imul(r | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function draw() {
    const W = document.documentElement.clientWidth, H = document.body.offsetHeight, dpr = Math.min(2, devicePixelRatio || 1), s = W < 520 ? 6 : W < 1000 ? 7 : 8;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const cols = Math.ceil(W / s), rows = Math.floor(H / s), ox = (W - cols * s) / 2, ground = rows - 3;
    const dot = (c, r, rad, colour, cover) => { if (cover) { ctx.fillStyle = "rgb(" + K.bg.join(",") + ")"; ctx.fillRect(ox + c * s, r * s, s, s); } ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(ox + (c + 0.5) * s, (r + 0.5) * s, rad * s, 0, 6.2832); ctx.fill(); };
    // floor and seats: logs laid across, seen from behind
    const pitch = 11, off = (cols % pitch) / 2, seatTop = (dx) => ground - 3.4 * Math.sqrt(Math.max(0, 1 - (dx / 4.2) ** 2));
    for (let r = ground - 4; r < rows; r++) for (let c = 0; c < cols; c++) {
      const dx = ((c + 0.5 - off) % pitch + pitch) % pitch - pitch / 2;
      if (r >= ground) { const l = 0.25 + 0.3 * (r - ground) / 3 + 0.4 * noise(c, r); dot(c, r, 0.08 + 0.4 * l, mix(K.floor[0], K.floor[1], l)); }
      else if (Math.abs(dx) < 4.2 && r + 0.5 >= seatTop(dx)) { const l = 0.4 + 0.45 * (1 - (r + 0.5 - seatTop(dx)) / 3.4) - 0.07 * dx; dot(c, r, 0.2 + 0.26 * Math.max(0, Math.min(1, l)), mix(K.bark[0], K.bark[1], l), true); }
    }
    // the two posts, just outside the screen's edges, from above its top down to the ground
    const b = document.querySelector(".screen").getBoundingClientRect(), top = Math.floor((b.top + scrollY) / s) - 1;
    for (const c0 of [Math.floor((b.left - ox) / s) - 2, Math.ceil((b.right - ox) / s)]) for (let r = top; r < ground; r++) for (let i = 0; i < 2; i++) {
      const l = (i ? 0.38 : 0.78) * (0.8 + 0.4 * noise(c0 + i, Math.floor(r / 3)));
      dot(c0 + i, r, 0.16 + 0.3 * l, mix(K.bark[0], K.bark[1], l), true);
    }
    // someone in the audience: the snake, coiled on a log with its head up toward the screen
    const seat = Math.max(1, Math.round(cols * 0.24 / pitch)), cx = Math.floor(off + pitch / 2 + seat * pitch), base = ground - 4;
    const body = [[0, -3, 3], [1, -2, 2], [2, 1, 2], [3, 2, 2], [4, 2, 3], [5, 2, 3]];           // [rows up from the log, first column, last column]
    for (const [up, from, to] of body) for (let d = from; d <= to; d++) {
      const head = up >= 4, band = !head && (d + up * 2 + 12) % 4 === 0;
      dot(cx + d, base - up, head ? 0.46 : 0.42, mix(band ? K.band : head && d === to && up === 5 ? K.hi : K.snake, K.hi, !band && up === 1 ? 0.35 : 0), true);
    }
  }
  let timer = 0; addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(draw, 120); }); addEventListener("load", draw); draw();
})();
</script></body></html>`);

/* ---- Study: the outline of the section. Private for now: publish.mjs puts it online only as an encrypted page
        (see there). This plain copy is for looking at locally. Notes themselves must not be written into this
        public repository; where they live is still to be decided ---- */
const TRACKS = [
  ["Foundry deep dive", "How Palantir Foundry works, taken apart piece by piece from the public documentation: the ontology, pipelines, lineage, actions.", "Starts here."],
  ["Hands-on", "What I did in Palantir Learning courses and in AIP exercises, written up as a log: what the task was, what I built, what I got wrong.", ""],
  ["Foundry in Python", "Building a small Foundry of my own in Python, one part at a time, to find out what each part is actually for.", ""],
];
out("study/notes.html", shell({ root: "../", title: "Study", body: `<main><div class="wrap">
<p class="crumb">Study</p><h1>Study</h1>
<p class="lead">Notes from studying Palantir Foundry, in three tracks. Nothing from interviews goes here.</p>
${TRACKS.map(([name, what, note], i) => `<section class="lane"><h2>Track ${i + 1}</h2><article class="row"><span class="when">${note || "Not started"}</span><div><h3>${name}</h3><p class="sum">${what}</p></div><p class="see soon">No notes yet</p></article></section>`).join("")}
</div></main>` }).replace('aria-current="page">Experience', '>Experience').replace('study/index.html">Study', 'study/index.html" aria-current="page">Study'));

/* ---- work index ---- */
const lanes = [...new Set(EXPERIENCES.map((e) => e.lane))];
out("work/index.html", shell({ root: "../", title: "Experience", rain: "sides", body: `<main><div class="wrap">
<h1>Experience</h1><p class="lead">Everything on the timeline: work, research, projects, clubs and awards. Some have a visual explanation; everything with a page is written up in the same eight steps.</p>
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
<p class="crumb"><a href="../index.html">Experience</a> / ${e.lane}</p>
<h1>${c ? c.title : e.title}</h1>
<p class="lead">${c ? c.outcome : e.summary}${c && c.draft && c.draft.lead ? " " + DRAFT : ""}</p>
<dl class="meta">${meta.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join("")}</dl>
<p class="see">${e.story ? `<a class="visual" href="story/index.html">Visual explanation →</a>` : `<span class="soon">Visual explanation: ${e.tier === "deep" ? "planned" : "none"}</span>`}</p>
${c && c.draft ? `<p class="draft-note">${DRAFT} marks text written with AI from ${c.draft.from}. The author has not reviewed it yet; the tag comes off a section once they have.</p>` : ""}
${c ? "" : `<div class="writeup"><div><p class="empty">This write-up is in progress. It will answer the same eight questions as the others: ${STEPS.map(([name]) => name).join(", ")}.</p>
<p class="next"><a href="../index.html">← All experience</a><a href="../${nextE.slug}/${nextE.story ? "story/" : ""}index.html">Next: ${nextE.title} →</a></p></div></div>`}
${!c ? "" : `<div class="writeup"><nav class="rail" aria-label="Steps"><ol>${STEPS.map(([name], n) => `<li><a href="#${id(n)}">${name}</a></li>`).join("")}</ol></nav>
<div>${STEPS.map(([name, ask], n) => `<section class="step" id="${id(n)}"><header><span class="no">${String(n + 1).padStart(2, "0")}</span><h2>${name}${c && c.draft && c.draft.steps[n] ? " " + DRAFT : ""}</h2><p class="ask">${ask}</p></header>
${c.steps[n]}</section>`).join("")}
${c.part ? `<p class="who" style="color:var(--ink-2);font-size:var(--step--1)"><b style="color:var(--ink)">My part.</b> ${c.part}</p>` : ""}
${c.now ? `<aside class="now"><strong>Re-decomposed on ${c.now.date}</strong>${c.now.text}</aside>` : ""}
<p class="next"><a href="../index.html">← All experience</a><a href="../${nextE.slug}/${nextE.story ? "story/" : ""}index.html">Next: ${nextE.title} →</a></p>
</div></div>`}</div></main>` }));
});
