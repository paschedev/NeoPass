import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import JsonLd from './JsonLd';

describe('JsonLd', () => {
  it('publica los datos como JSON-LD', () => {
    const { container } = render(<JsonLd data={{ name: 'Noche de Techno' }} />);

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(JSON.parse(script?.innerHTML ?? '')).toEqual({
      name: 'Noche de Techno',
    });
  });

  it('un título con </script> no cierra la etiqueta ni deja inyectar código', () => {
    const title = '</script><script>alert(1)</script>';
    const { container } = render(<JsonLd data={{ name: title }} />);

    const scripts = container.querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].innerHTML).not.toContain('</script');
    // Google lo lee igual: el JSON trae el texto original.
    expect(JSON.parse(scripts[0].innerHTML)).toEqual({ name: title });
  });
});
