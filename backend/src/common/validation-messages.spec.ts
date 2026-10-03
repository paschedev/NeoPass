import { ValidationError } from 'class-validator';
import { validationMessages } from './validation-messages';

const error = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({ property, constraints, children });

describe('validationMessages', () => {
  it('devuelve los mensajes de cada campo tal cual', () => {
    expect(
      validationMessages([
        error('title', { minLength: 'El título es obligatorio' }),
        error('venueName', { maxLength: 'El lugar es muy largo' }),
      ]),
    ).toEqual(['El título es obligatorio', 'El lugar es muy largo']);
  });

  it('los mensajes de una tanda o entrada salen sin la ruta técnica delante', () => {
    expect(
      validationMessages([
        error('batches', undefined, [
          error('0', undefined, [
            error('ticketTypes', undefined, [
              error('0', undefined, [
                error('stock', { max: 'El stock máximo es 100.000' }),
              ]),
            ]),
          ]),
        ]),
      ]),
    ).toEqual(['El stock máximo es 100.000']);
  });

  it('un mismo mensaje repetido en varias tandas aparece una sola vez', () => {
    const tooLong = () =>
      error('0', undefined, [
        error('name', { maxLength: 'El nombre de la tanda es muy largo' }),
      ]);

    expect(
      validationMessages([
        error('batches', undefined, [
          tooLong(),
          { ...tooLong(), property: '1' },
        ]),
      ]),
    ).toEqual(['El nombre de la tanda es muy largo']);
  });
});
