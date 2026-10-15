// Native MathML keeps fractions, roots and indices structured and accessible.
export const formulas: Record<number, string[]> = {
  1: [
    '<msub><mi>R</mi><mi>x</mi></msub><mo>=</mo><mi>R</mi><mo>·</mo><mfrac><msub><mi>l</mi><mn>1</mn></msub><msub><mi>l</mi><mn>2</mn></msub></mfrac>',
  ],
  2: [
    '<msub><mi>ℰ</mi><mi>x</mi></msub><mo>=</mo><msub><mi>ℰ</mi><mi>n</mi></msub><mo>·</mo><mfrac><msub><mi>l</mi><mi>x</mi></msub><msub><mi>l</mi><mi>n</mi></msub></mfrac>',
  ],
  3: [
    '<msub><mi>R</mi><mtext>мет</mtext></msub><mo>=</mo><msub><mi>R</mi><mn>0</mn></msub><mo>(</mo><mn>1</mn><mo>+</mo><mi>α</mi><mi>t</mi><mo>)</mo>',
    '<msub><mi>R</mi><mtext>нап</mtext></msub><mo>=</mo><mi>A</mi><mspace width="0.15em"/><mtext>exp</mtext><mo>⁡</mo><mrow><mo>(</mo><mfrac><mrow><mi>Δ</mi><mi>W</mi></mrow><mrow><mn>2</mn><mi>k</mi><mi>T</mi></mrow></mfrac><mo>)</mo></mrow>',
  ],
  4: [
    '<msub><mi>R</mi><mtext>ст</mtext></msub><mo>=</mo><mfrac><mrow><mo>|</mo><mi>U</mi><mo>|</mo></mrow><mrow><mo>|</mo><mi>I</mi><mo>|</mo></mrow></mfrac>',
    '<mi>K</mi><mo>=</mo><mfrac><msub><mi>R</mi><mtext>зв</mtext></msub><msub><mi>R</mi><mtext>пр</mtext></msub></mfrac>',
  ],
  5: [
    '<mi>x</mi><mo>=</mo><msub><mi>α</mi><mi>x</mi></msub><msub><mi>U</mi><mi>x</mi></msub>',
    '<mi>y</mi><mo>=</mo><msub><mi>α</mi><mi>y</mi></msub><msub><mi>U</mi><mi>y</mi></msub>',
    '<msub><mi>α</mi><mi>x</mi></msub><mo>=</mo><mfrac><mi>L</mi><mrow><mn>2</mn><msqrt><mn>2</mn></msqrt><msub><mi>U</mi><mtext>еф</mtext></msub></mrow></mfrac>',
  ],
  6: [
    '<mi>Z</mi><mo>=</mo><msqrt><msup><mi>R</mi><mn>2</mn></msup><mo>+</mo><msup><mrow><mo>(</mo><mi>ω</mi><mi>L</mi><mo>−</mo><mfrac><mn>1</mn><mrow><mi>ω</mi><mi>C</mi></mrow></mfrac><mo>)</mo></mrow><mn>2</mn></msup></msqrt>',
    '<msub><mi>I</mi><mtext>еф</mtext></msub><mo>=</mo><mfrac><msub><mi>U</mi><mtext>еф</mtext></msub><mi>Z</mi></mfrac>',
  ],
  7: [
    '<mi>P</mi><mo>=</mo><mi>U</mi><mi>I</mi><mspace width="0.15em"/><mtext>cos</mtext><mo>⁡</mo><mspace width="0.1em"/><mi>φ</mi>',
    '<mi>R</mi><mo>=</mo><mfrac><mi>P</mi><msup><mi>I</mi><mn>2</mn></msup></mfrac>',
    '<mi>Z</mi><mo>=</mo><mfrac><mi>U</mi><mi>I</mi></mfrac>',
  ],
  8: [
    '<msub><mi>C</mi><mi>x</mi></msub><mo>=</mo><msub><mi>C</mi><mn>0</mn></msub><mo>·</mo><mfrac><msub><mi>l</mi><mn>2</mn></msub><msub><mi>l</mi><mn>1</mn></msub></mfrac>',
  ],
};

export function renderFormulas(equations: string[]) {
  return `<div class="formula-list">${equations.map(equation =>
    `<div class="formula-equation"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${equation}</math></div>`
  ).join('')}</div>`;
}

export const bridgeUncertaintyFormulas=[
 '<msub><mi>δ</mi><msub><mi>R</mi><mi>x</mi></msub></msub><mo>=</mo><mfrac><mrow><mi>Δ</mi><mi>R</mi></mrow><mi>R</mi></mfrac><mo>+</mo><mfrac><mrow><mi>Δ</mi><msub><mi>l</mi><mn>1</mn></msub></mrow><msub><mi>l</mi><mn>1</mn></msub></mfrac><mo>+</mo><mfrac><mrow><mi>Δ</mi><mi>L</mi><mo>+</mo><mi>Δ</mi><msub><mi>l</mi><mn>1</mn></msub></mrow><msub><mi>l</mi><mn>2</mn></msub></mfrac>',
 '<mi>Δ</mi><msub><mi>R</mi><mi>x</mi></msub><mo>=</mo><msub><mi>R</mi><mi>x</mi></msub><mo>·</mo><msub><mi>δ</mi><msub><mi>R</mi><mi>x</mi></msub></msub>',
];
