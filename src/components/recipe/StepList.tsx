interface StepListProps {
  instructions: { '@type': 'HowToStep'; text: string }[]
}

export default function StepList({ instructions }: StepListProps) {
  return (
    <section className="mb-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
        Instructions
      </h3>
      <ol className="space-y-3">
        {instructions.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm print:[break-inside:avoid]">
            <span className="shrink-0 w-6 h-6 bg-green-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {i + 1}
            </span>
            <p className="text-gray-700 dark:text-gray-200 leading-relaxed pt-0.5">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
