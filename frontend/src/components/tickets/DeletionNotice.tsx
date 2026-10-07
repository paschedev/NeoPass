import { deletionNoticeTitle, type EventDeletion } from '@/utils/event-deletion';

// Lo que ve quien compró cuando el evento se eliminó. El organizador ve lo
// mismo como vista previa antes de eliminarlo.
export default function DeletionNotice({
  deletion,
}: {
  deletion: EventDeletion;
}) {
  const { byNeoPass, organizerName, contactEmail } = deletion;
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-sm text-neutral-300 space-y-2 text-left">
      <p className="font-semibold text-amber-300">
        {deletionNoticeTitle(byNeoPass)}
      </p>
      <p>Esta entrada ya no sirve para entrar.</p>
      <p>
        Para consultas o devoluciones, escribile a {organizerName}
        {contactEmail && (
          <>
            :{' '}
            <a
              href={`mailto:${contactEmail}`}
              className="text-indigo-300 underline break-all"
            >
              {contactEmail}
            </a>
          </>
        )}
        .
      </p>
      <p className="text-neutral-400">
        NeoPass no gestiona las devoluciones ni los reclamos de este evento.
      </p>
    </div>
  );
}
