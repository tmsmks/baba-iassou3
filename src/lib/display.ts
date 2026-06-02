/** Formate le nom à afficher : "Prénom Nom" si nom dispo, sinon "Prénom". */
export function displayName(p: { prenom?: string | null; nom?: string | null } | null | undefined): string {
  if (!p) return '';
  const prenom = (p.prenom ?? '').trim();
  const nom = (p.nom ?? '').trim();
  if (prenom && nom) return `${prenom} ${nom}`;
  return prenom || nom || '';
}

/** Calcule l'âge en années entières à partir d'une date "YYYY-MM-DD". null si invalide. */
export function ageFromDate(dateStr: string | null | undefined, refDate: Date = new Date()): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (!y || !mo || !d) return null;
  let age = refDate.getFullYear() - y;
  const birthdayThisYear = new Date(refDate.getFullYear(), mo - 1, d);
  if (refDate < birthdayThisYear) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

/** "1999-12-25" → "25/12/1999" pour l'affichage FR. */
export function formatDateFR(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Masque la saisie en format DD/MM/YYYY au fil de la frappe. */
export function maskDateFR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "25/12/1999" → "1999-12-25" si valide, sinon null. */
export function parseDateFR(input: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  if (y < 1900 || y > new Date().getFullYear()) return null;
  // Vérifie que la date est réelle (ex: 31/02 invalide)
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  if (dt > new Date()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
