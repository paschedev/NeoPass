import { redirect } from 'next/navigation';

// El Panel RPP pasó a ser la página Staff, que muestra todos los roles del
// staff. El detalle de ventas de cada evento sigue en /panel/rpp/:id.
export default function RppPanelRedirect() {
  redirect('/panel/staff');
}
