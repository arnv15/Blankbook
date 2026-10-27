import { Button } from '@/components/ui/button'
import type { SectionKind } from '@/lib/types'

export function Directions({ section, onClose }: { section: SectionKind; onClose(): void }) {
  return (
    <>
      <div className="fixed inset-0 top-[calc(4.5rem+3px)] z-10 bg-black/30" onClick={onClose} />
      <div className="absolute top-full left-4 z-20 mt-2 max-h-[70vh] w-[min(46rem,calc(100vw-2rem))] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl sm:left-7">
        <div className="space-y-3 font-serif text-[15px] leading-relaxed text-bb-ink">
          {section === 'rw' ? <RwDirections /> : <MathDirections />}
        </div>
        <div className="mt-5 flex justify-end">
          <Button className="rounded-full bg-[#fedb00] px-6 font-semibold text-bb-ink hover:bg-[#f5d000]" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  )
}

function RwDirections() {
  return (
    <>
      <p>
        The questions in this section test a range of important reading and writing skills. Each question comes with one or more
        passages, which may include a table or graph. Read each passage and question carefully, then choose the best answer based on
        the passage(s).
      </p>
      <p>Every question in this section is multiple-choice with four answer choices and a single best answer.</p>
    </>
  )
}

export function MathDirections() {
  return (
    <>
      <p>
        The questions in this section test a range of important math skills. You may use a calculator on every question. The
        reference sheet, calculator, and these directions are available throughout the test.
      </p>
      <p className="font-semibold">Unless otherwise indicated:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>All variables and expressions represent real numbers.</li>
        <li>Figures provided are drawn to scale.</li>
        <li>All figures lie in a plane.</li>
        <li>
          The domain of a given function <em>f</em> is the set of all real numbers <em>x</em> for which <em>f</em>(<em>x</em>) is a real number.
        </li>
      </ul>
      <p>
        For <strong>multiple-choice questions</strong>, solve each problem and choose the correct answer from the choices provided. Each
        has a single correct answer.
      </p>
      <p>
        For <strong>student-produced response questions</strong>, solve each problem and enter your answer as described in the
        directions next to the question.
      </p>
    </>
  )
}

/** Shown in the left pane next to grid-in math questions, like Bluebook. */
export function SprDirections() {
  return (
    <div className="space-y-3 font-serif text-[15px] leading-relaxed text-bb-ink">
      <h2 className="font-sans text-lg font-bold">Student-produced response directions</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>If you find more than one correct answer, enter only one of them.</li>
        <li>You can enter up to 5 characters for a positive answer and up to 6 characters (including the negative sign) for a negative answer.</li>
        <li>If your answer is a fraction that doesn't fit in the space, enter its decimal equivalent.</li>
        <li>If your answer is a decimal that doesn't fit, enter it by truncating or rounding at the fourth digit.</li>
        <li>
          If your answer is a mixed number (like 3½), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).
        </li>
        <li>Don't enter symbols such as a percent sign, comma, or dollar sign.</li>
      </ul>
      <table className="mt-2 w-full border-collapse text-center font-sans text-sm">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-300 p-2">Answer</th>
            <th className="border border-neutral-300 p-2">Acceptable ways to enter</th>
            <th className="border border-neutral-300 p-2">Unacceptable: will NOT receive credit</th>
          </tr>
        </thead>
        <tbody className="font-serif">
          <tr>
            <td className="border border-neutral-300 p-2">3.5</td>
            <td className="border border-neutral-300 p-2">3.5<br />3.50<br />7/2</td>
            <td className="border border-neutral-300 p-2">31/2<br />3 1/2</td>
          </tr>
          <tr>
            <td className="border border-neutral-300 p-2">2/3</td>
            <td className="border border-neutral-300 p-2">2/3<br />.6666<br />.6667<br />0.666<br />0.667</td>
            <td className="border border-neutral-300 p-2">0.66<br />.66<br />0.67<br />.67</td>
          </tr>
          <tr>
            <td className="border border-neutral-300 p-2">−1/3</td>
            <td className="border border-neutral-300 p-2">−1/3<br />−.3333<br />−0.333</td>
            <td className="border border-neutral-300 p-2">−.33<br />−0.33</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
