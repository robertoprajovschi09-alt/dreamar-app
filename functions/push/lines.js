/*
 * Post-time reminder copy. These are deliberately blunt and profane — they only
 * ever reach members of the agency (their own subscribed devices), never a
 * client. {title} and {client} are filled at send time; titles over 40 chars are
 * clipped with an ellipsis. Do not soften or "correct" these lines.
 */
export const FUNNY_LINES = [
  { t: "18:30, șefu'!", b: "«{title}» pentru {client} nu se postează singur, băga-mi-aș. Hai!" },
  { t: "Alo, panaramo 📣", b: "E ora de postat «{title}». Lasă scroll-ul, fă bani." },
  { t: "Futu-i ceasu' mă-sii", b: "E fix ora. «{title}» → live. Acum, nu peste 5 minute." },
  { t: "Reminder cu dragoste", b: "Dacă nu postezi «{title}» acum, mâine te înjur mai urât. Pe bune." },
  { t: "Algoritmu' nu doarme", b: "«{title}» stă degeaba în telefon. Aruncă-l în lume, ce pana mea." },
  { t: "Nu mă face să vin acolo", b: "«{title}» e programat pe ACUM. Mișcă." },
  { t: "Băi artistule", b: "Capodopera «{title}» nu-i capodoperă dacă n-o vede nimeni. Postează." },
  { t: "Ding ding, muncitorule", b: "{client} te plătește. «{title}» sus, acum." },
  { t: "O secundă de sinceritate", b: "Știi cine postează la timp? Ăia cu 7.000 pe lună. «{title}». Hai." },
  { t: "Ceasul zice că-i vremea", b: "«{title}» — dă-i drumul, pe urmă te lauzi în Kill List." },
  { t: "Caterincă zero", b: "Serios acum: «{title}» pentru {client}. Două tapuri și gata." },
  { t: "Nu te fă că nu vezi", b: "Da, tu. «{title}». Postează-l dracu' odată și fugi." },
];

// Clip title as it appears inside a line: clipped to 40 chars with an ellipsis.
export function clipTitle(title) {
  const t = (title || "clip").trim();
  return t.length > 40 ? t.slice(0, 40) + "…" : t;
}

// Fill one line's {title}/{client} placeholders. `pick` in [0,1) selects the line.
export function renderLine(pick, title, client) {
  const line = FUNNY_LINES[Math.floor(pick * FUNNY_LINES.length) % FUNNY_LINES.length];
  const t = clipTitle(title);
  const c = (client || "client").trim() || "client";
  const sub = (s) => s.replaceAll("{title}", t).replaceAll("{client}", c);
  return { title: sub(line.t), body: sub(line.b) };
}
