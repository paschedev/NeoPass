import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import PreguntasFrecuentesPage from './page';
import { FAQ_SECTIONS } from '@/utils/faq';

describe('Preguntas frecuentes', () => {
  it('muestra cada pregunta con su respuesta, para quien compra y quien organiza', () => {
    render(<PreguntasFrecuentesPage />);

    for (const section of FAQ_SECTIONS) {
      const region = screen.getByRole('region', { name: section.title });
      for (const { question, answer } of section.items) {
        expect(within(region).getByText(question)).toBeVisible();
        expect(within(region).getByText(answer)).toBeVisible();
      }
    }
  });

  it('publica las mismas preguntas como ficha para Google', () => {
    const { container } = render(<PreguntasFrecuentesPage />);

    const data = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')
        ?.innerHTML ?? '{}',
    );
    const questions = FAQ_SECTIONS.flatMap((s) => s.items);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(questions.length);
    expect(data.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: questions[0].question,
      acceptedAnswer: { '@type': 'Answer', text: questions[0].answer },
    });
  });
});
