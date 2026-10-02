import { ValidationError } from 'class-validator';

function collect(errors: ValidationError[], messages: Set<string>) {
  for (const { constraints, children } of errors) {
    Object.values(constraints ?? {}).forEach((message) =>
      messages.add(message),
    );
    if (children?.length) collect(children, messages);
  }
}

// The messages of every failed rule, nested ones included, as the user reads
// them: Nest's default puts the technical path in front ("batches.0.…").
export function validationMessages(errors: ValidationError[]): string[] {
  const messages = new Set<string>();
  collect(errors, messages);
  return [...messages];
}
