// Passage library for the Tensor School Typing Championship.
//
// Each contest gets a fresh passage: `startEvent` picks one at random (never the
// one just used) and `startFinal` picks a different one again, so finalists
// cannot rehearse the qualifier text. Passages are plain ASCII (straight quotes,
// hyphens, no em dashes) so every keyboard can type them, and sit in a tight
// length band so WPM is comparable between contests.
//
// Hosts can still paste a custom passage in the admin config (passage_mode = 'custom').

export const PASSAGE_LIBRARY: string[] = [
  'Silicon precision meets human agility on the keys of the future. Deep learning architectures transform simple vectors into complex thoughts, training neural networks across millions of gradient steps. As artificial intelligence reshapes human potential, mastery over fundamental tools remains paramount. Every keystroke is a signal, an instruction executed with absolute clarity and unmatched velocity. In this championship, focus and discipline separate the ordinary from the extraordinary. Push through the cognitive barrier, maintain composure under intense pressure, and calibrate your rhythm to perfection.',

  'A neural network begins as a pile of random numbers. It knows nothing about cats, chess, or the structure of a sentence. Then the data arrives, one batch at a time, and a loss function quietly measures how wrong each guess was. Gradients flow backward through every layer, nudging millions of weights by a tiny amount. Repeat this a few hundred thousand times and something remarkable happens: the noise organizes itself into features, the features into concepts, and the concepts into a model that can describe a photograph it has never seen before.',

  'Good engineers write code that works. Great engineers write code that other people can read six months later. The difference is rarely cleverness; it is naming things honestly, keeping functions small, and refusing to let a quick hack become permanent. Tests are not a tax on progress, they are the receipt that proves progress happened. When a build turns green after a difficult change, that feeling of certainty is worth more than any shortcut. Ship carefully, measure what matters, and leave the codebase a little better than you found it.',

  'The first computers filled entire rooms and were programmed by rewiring their circuits by hand. Today a phone in your pocket runs billions of instructions every second and talks to data centers on the other side of the planet. What did not change is the person at the keyboard. Ideas still have to be typed, line by line, into an editor. Speed matters, but accuracy matters more, because a single wrong character can send a program searching for a file that does not exist or a loop running forever.',

  'Large language models predict the next token, and yet from that simple objective they learn to summarize documents, translate between languages, and reason through problems step by step. The secret is scale combined with structure: attention lets every word look at every other word, and layers stack those relationships into deeper abstractions. Training them takes thousands of accelerators humming for weeks. Using them well takes a different skill: asking clear questions, checking the answers, and knowing when the machine is confidently wrong.',

  'Debugging is detective work. You start with a symptom, a crash or a number that is slightly off, and you form a hypothesis about what could cause it. Then you look for evidence: logs, stack traces, the value of a variable at the exact moment things went sideways. Most bugs are boring once found: an off-by-one error, a null that should never have been null, a cache that was never cleared. The discipline is to resist guessing, change one thing at a time, and let the system tell you what actually happened.',

  'Data is the raw material of modern intelligence, but raw data is messy. Dates arrive in five formats, names are spelled three ways, and the most important column is empty for half the rows. Before any model sees it, someone has to clean, join, and validate every record. This unglamorous work decides whether the final system is trustworthy. A beautiful dashboard built on broken data is worse than no dashboard at all, because it looks right while being wrong.',

  'Touch typing is a small superpower. When your fingers know where every key lives, your eyes stay on the screen and your thoughts flow straight into the document. Programmers who type fluently spend less attention on the mechanics of input and more on the shape of the problem. The home row is the anchor: index fingers rest on F and J, and every other key is a short, repeatable reach from there. Practice with accuracy first; speed follows naturally once the movements become automatic.',

  'Every algorithm is a trade-off. A hash table answers lookups in constant time but keeps no order. A balanced tree stays sorted but pays a logarithmic cost on each operation. Sorting a million numbers is trivial with the right method and impossible with the wrong one. Learning computer science is learning to see these trade-offs instantly, to estimate how a solution will behave when the input grows a thousand times larger, and to pick the structure that fits the problem rather than the one you happen to remember.',

  'The internet is a network of networks, held together by agreements rather than a central authority. A request for a web page is broken into packets, each labeled with an address, and routers pass them along one hop at a time until they reach a server that may be thousands of kilometers away. The reply travels back the same way, often along a different path. All of this happens in a few hundred milliseconds, so reliably that we only notice the system when it fails.',

  'Version control is a time machine for code. Every commit is a snapshot you can return to, every branch is a parallel universe where an idea can be tried without risk. Merging brings those universes back together, and conflicts are simply two honest attempts to improve the same lines. Teams that commit small, descriptive changes rarely lose work and can trace any bug to the exact moment it was introduced. Write the message you will want to read when something breaks at midnight.',

  'Machine learning models do not understand fairness, they only reproduce patterns. If the training data under-represents a group, the model will perform worse for that group and nobody will notice until it matters. Responsible engineering means testing across populations, documenting what a model was built to do, and being willing to say that a system is not ready. The most important line in a deployment checklist is the one that asks who could be harmed if this prediction is wrong.',
];

/**
 * Picks a random passage from the library, avoiding any in `exclude`
 * (compared after trimming) so consecutive rounds never repeat.
 */
export function pickPassage(exclude: Array<string | null | undefined> = []): string {
  const banned = new Set(exclude.filter(Boolean).map((p) => (p as string).trim()));
  const candidates = PASSAGE_LIBRARY.filter((p) => !banned.has(p.trim()));
  const pool = candidates.length > 0 ? candidates : PASSAGE_LIBRARY;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function isLibraryPassage(passage: string | null | undefined): boolean {
  if (!passage) return false;
  const t = passage.trim();
  return PASSAGE_LIBRARY.some((p) => p.trim() === t);
}
