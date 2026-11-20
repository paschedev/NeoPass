import { z } from 'zod';

// zod arma sus validadores con `new Function` si el navegador lo permite, y
// para saberlo lo prueba al crear el primer esquema. La política de contenido
// no deja evaluar texto como código, así que esa prueba se anota como aviso en
// cada página. Sin compilar los validadores, zod no la hace. Los formularios
// son chicos: no se nota.
//
// Todo el front importa zod desde acá (el lint lo exige), así esto corre antes
// de crear cualquier esquema.
z.config({ jitless: true });

export { z };
