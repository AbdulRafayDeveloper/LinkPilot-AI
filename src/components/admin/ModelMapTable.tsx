import React from "react"
import { ArrowRight, CircleSlash, Table2 } from "lucide-react"
import type { ModelChainStep, ModelMap, ModelMapRow } from "@/types/modelPriority"

// Default plus two fallbacks covers the three providers there are; a longer chain would add a column
const MIN_COLUMNS = 3
const columnName = (index: number) => (index === 0 ? "Default" : `Fallback ${index}`)

const Step: React.FC<{ step: ModelChainStep | undefined; isDefault: boolean }> = ({ step, isDefault }) =>
  step ? (
    <span className="flex flex-col gap-0.5">
      <span className={`text-[13px] font-bold ${isDefault ? "text-primary" : "text-on-surface"}`}>{step.label}</span>
      <code className="break-all text-[11.5px] text-on-surface-variant">{step.model}</code>
    </span>
  ) : (
    <span className="text-[12px] text-outline">None</span>
  )

const Skipped: React.FC<{ row: ModelMapRow }> = ({ row }) =>
  row.skipped.length === 0 ? (
    <span className="text-[12px] text-outline">None</span>
  ) : (
    <ul className="flex flex-col gap-1">
      {row.skipped.map((skip) => (
        <li key={skip.provider} className="flex items-start gap-1 text-[12px] text-outline">
          <CircleSlash size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">{skip.label}</span>: {skip.reason}
          </span>
        </li>
      ))}
    </ul>
  )

// What the row says besides the chain: a note, an admin's own order, or that nothing can do the job here
const RowNotes: React.FC<{ row: ModelMapRow }> = ({ row }) => (
  <>
    {row.chain.length === 0 && <span className="block text-[12px] font-semibold text-error">Nothing can do this on this deployment</span>}
    {row.note && <span className="block text-[12px] text-on-surface-variant">{row.note}</span>}
    {row.adminChain && (
      <span className="mt-0.5 inline-flex flex-wrap items-center gap-1 rounded-md bg-primary-fixed px-1.5 py-0.5 text-[11.5px] font-semibold text-primary">
        Admins (own order):
        {row.adminChain.map((step, index) => (
          <React.Fragment key={step.provider}>
            {index > 0 && <ArrowRight size={11} aria-label="then" />}
            {step.label}
          </React.Fragment>
        ))}
      </span>
    )}
  </>
)

/**
 * The model map on AI Model Priority: for every module, each job it runs (writing, web research,
 * screenshots, speech, embeddings, images), the model that does it by default and the ones that take
 * over in turn, and the providers passed over with why. A table from xl, cards below it.
 */
export const ModelMapTable: React.FC<{ map: ModelMap }> = ({ map }) => {
  const columns = Math.max(MIN_COLUMNS, ...map.rows.map((row) => row.chain.length))
  const indexes = Array.from({ length: columns }, (_, index) => index)
  const modules = map.rows.reduce<{ module: string; title: string; rows: ModelMapRow[] }[]>((groups, row) => {
    const last = groups[groups.length - 1]
    if (last?.module === row.module) last.rows.push(row)
    else groups.push({ module: row.module, title: row.title, rows: [row] })
    return groups
  }, [])

  return (
    <section aria-labelledby="model-map" className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
      <div>
        <h2 id="model-map" className="flex items-center gap-2 text-[15px] font-bold text-on-surface">
          <Table2 size={17} className="text-primary" aria-hidden="true" />
          Which model each module uses
        </h2>
        <p className="mt-1 text-[12.5px] text-on-surface-variant">
          The <span className="font-semibold text-primary">Default</span>{" "}
          model is tried first. When it fails (its limit is used up, it errors, times out or gives an
          unusable answer), Fallback 1 takes over, then Fallback 2. This is what every regular user gets, read from this deployment&apos;s settings.
          {map.groqKeys > 0 && (
            <>
              {" "}
              Groq tries all of its {map.groqKeys} keys before any fallback{map.groqActiveKey ? `, starting from key ${map.groqActiveKey}, the one answering now` : ""}.
            </>
          )}
        </p>
      </div>

      <div className="hidden xl:block">
        <table className="w-full min-w-[900px] border-collapse text-left [overflow-wrap:anywhere]">
          <thead>
            <tr className="border-b border-outline-variant text-[11px] font-bold uppercase tracking-wide text-outline">
              <th scope="col" className="w-[150px] py-2 pr-3">
                Module
              </th>
              <th scope="col" className="w-[200px] py-2 pr-3">
                Job
              </th>
              {indexes.map((index) => (
                <th key={index} scope="col" className="py-2 pr-3">
                  {columnName(index)}
                </th>
              ))}
              <th scope="col" className="w-[210px] py-2">
                Not used here
              </th>
            </tr>
          </thead>
          <tbody>
            {modules.map((group) =>
              group.rows.map((row, rowIndex) => (
                <tr key={`${row.module}-${row.job}`} className={`align-top ${rowIndex === group.rows.length - 1 ? "border-b border-outline-variant" : ""}`}>
                  {rowIndex === 0 && (
                    <th scope="rowgroup" rowSpan={group.rows.length} className="py-2.5 pr-3 text-[13px] font-bold text-on-surface">
                      {group.title}
                    </th>
                  )}
                  <td className="py-2.5 pr-3">
                    <span className="block text-[13px] font-semibold text-on-surface">{row.job}</span>
                    <RowNotes row={row} />
                  </td>
                  {indexes.map((index) => (
                    <td key={index} className="py-2.5 pr-3">
                      <Step step={row.chain[index]} isDefault={index === 0} />
                    </td>
                  ))}
                  <td className="py-2.5">
                    <Skipped row={row} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
        {modules.map((group) => (
          <article key={group.module} className="flex flex-col gap-2 rounded-xl border border-outline-variant p-3">
            <h3 className="text-[14px] font-bold text-on-surface">{group.title}</h3>
            {group.rows.map((row) => (
              <div key={row.job} className="flex flex-col gap-1.5 border-t border-outline-variant/60 pt-2 first-of-type:border-t-0 first-of-type:pt-0">
                <span className="text-[13px] font-semibold text-on-surface">{row.job}</span>
                <RowNotes row={row} />
                <dl className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1.5">
                  {indexes
                    .filter((index) => index === 0 || row.chain[index])
                    .map((index) => (
                      <React.Fragment key={index}>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-outline">{columnName(index)}</dt>
                        <dd>
                          <Step step={row.chain[index]} isDefault={index === 0} />
                        </dd>
                      </React.Fragment>
                    ))}
                  {row.skipped.length > 0 && (
                    <>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-outline">Not used</dt>
                      <dd>
                        <Skipped row={row} />
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  )
}
