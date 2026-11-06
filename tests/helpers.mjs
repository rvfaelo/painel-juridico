export function cnj(serial=1,j='8',court='19') {
  const base=String(serial).padStart(7,'0')+'2026'+j+court+'0001';
  const check=String(98n-BigInt(base+'00')%97n).padStart(2,'0');
  return base.slice(0,7)+check+base.slice(7);
}
export const fixtureCnj=cnj();
