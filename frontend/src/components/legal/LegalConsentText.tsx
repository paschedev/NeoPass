import { Fragment } from 'react';
import { LEGAL_DOCUMENTS, legalDocumentsFor } from '@/utils/legal';

// El texto de la casilla del registro, con cada documento que corresponde
// abriendo en otra pestaña: quien organiza acepta también sus términos.
export default function LegalConsentText({
  isOrganizer,
}: {
  isOrganizer: boolean;
}) {
  const documents = legalDocumentsFor(isOrganizer);

  return (
    <>
      Soy mayor de 18 años y acepto{' '}
      {documents.map((key, i) => {
        const { article, title, href } = LEGAL_DOCUMENTS[key];
        const separator =
          i === 0 ? '' : i === documents.length - 1 ? ' y ' : ', ';
        return (
          <Fragment key={key}>
            {separator}
            {article}{' '}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              {title}
            </a>
          </Fragment>
        );
      })}
      , incluida la transferencia de mis datos a EE. UU.
    </>
  );
}
