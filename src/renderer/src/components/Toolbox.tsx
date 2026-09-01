import { formatPrice } from '../lib/format'
import { statusLabel } from '../lib/boxChart'
import { BOX_MARK_EXPLAIN, explainLevel, kindLabel, methodColor, SR_METHODS } from '../lib/supportResistance'
import { useAppStore } from '../store/useAppStore'
import type { PriceBox, SRLevel } from '../../../shared/types'

function HoverNote({ title, text }: { title: string; text: string }): JSX.Element {
  return (
    <span className="sr-tip" role="tooltip">
      <strong>{title}</strong>
      {text}
    </span>
  )
}

interface Props {
  boxes: PriceBox[]
  srLevels: SRLevel[]
}

export function Toolbox({ boxes = [], srLevels = [] }: Props): JSX.Element {
  const open = useAppStore((s) => s.toolboxOpen)
  const setToolboxOpen = useAppStore((s) => s.setToolboxOpen)
  const boxEnabled = useAppStore((s) => s.boxEnabled)
  const setBoxEnabled = useAppStore((s) => s.setBoxEnabled)
  const sensitivity = useAppStore((s) => s.boxSensitivity)
  const setBoxSensitivity = useAppStore((s) => s.setBoxSensitivity)
  const srEnabled = useAppStore((s) => s.srEnabled)
  const setSrEnabled = useAppStore((s) => s.setSrEnabled)
  const srMethods = useAppStore((s) => s.srMethods) ?? []
  const toggleSrMethod = useAppStore((s) => s.toggleSrMethod)
  const main = boxes[0]

  return (
    <aside className={`toolbox ${open ? 'open' : ''}`}>
      <div className="toolbox-head">
        <strong>工具箱</strong>
        <button type="button" className="tab" onClick={() => setToolboxOpen(false)}>
          关闭
        </button>
      </div>
      <div className="toolbox-body">
        <section className="toolbox-section">
          <div className="toolbox-row">
            <span>智能箱体图</span>
            <button
              type="button"
              className={`switch ${boxEnabled ? 'on' : ''}`}
              onClick={() => setBoxEnabled(!boxEnabled)}
              aria-label="切换智能箱体图"
            />
          </div>
          <div className="toolbox-row">
            <span>灵敏度</span>
            <div className="sens-group">
              {(
                [
                  ['conservative', '保守'],
                  ['standard', '标准'],
                  ['sensitive', '灵敏']
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`sens-btn ${sensitivity === value ? 'active' : ''}`}
                  onClick={() => setBoxSensitivity(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="hint">箱体按日K摆动点聚类识别，绘制于日线图。</p>
          {boxEnabled && !main && <p className="hint">当前周期未识别到足够清晰的整理箱体。</p>}
          {boxEnabled && main && (
            <div className="box-card">
              <h3>{statusLabel(main.status)}</h3>
              <div className="has-tip">
                箱顶 {formatPrice(main.high)}
                <HoverNote title="箱顶" text={BOX_MARK_EXPLAIN.high} />
              </div>
              <div className="has-tip">
                中轴 {formatPrice(main.mid)}
                <HoverNote title="箱体中轴" text={BOX_MARK_EXPLAIN.mid} />
              </div>
              <div className="has-tip">
                箱底 {formatPrice(main.low)}
                <HoverNote title="箱底" text={BOX_MARK_EXPLAIN.low} />
              </div>
              <div>上沿触碰 {main.topTouches} 次</div>
              <div>下沿触碰 {main.bottomTouches} 次</div>
              <div>箱内占比 {(main.insideRatio * 100).toFixed(0)}%</div>
              <div>
                区间 {main.startTime} ~ {main.endTime}
              </div>
            </div>
          )}
        </section>

        <section className="toolbox-section">
          <div className="toolbox-row">
            <span>支撑与压力</span>
            <button
              type="button"
              className={`switch ${srEnabled ? 'on' : ''}`}
              onClick={() => setSrEnabled(!srEnabled)}
              aria-label="切换支撑压力位"
            />
          </div>
          <p className="hint">不同算法定义不同，可多选对照。把鼠标放到标记上可查看含义。仅供研究。</p>
          <div className="method-list">
            {SR_METHODS.map((method) => {
              const checked = srMethods.includes(method.id)
              return (
                <label key={method.id} className={`method-item ${checked ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!srEnabled}
                    onChange={() => toggleSrMethod(method.id)}
                  />
                  <span className="method-dot" style={{ background: method.color }} />
                  <span className="method-copy">
                    <strong>{method.label}</strong>
                    <span>{method.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {srEnabled && srMethods.length === 0 && <p className="hint">请至少勾选一种算法。</p>}
          {srEnabled && srLevels.length > 0 && (
            <div className="box-card">
              <h3>计算结果</h3>
              {srLevels.map((level, index) => (
                <div
                  key={`${level.method}-${level.label}-${index}`}
                  className="sr-level has-tip"
                >
                  <span>
                    <span className="method-dot" style={{ background: methodColor(level.method) }} />
                    {level.label}
                    <em>{kindLabel(level.kind)}</em>
                  </span>
                  <span>{formatPrice(level.price)}</span>
                  <HoverNote
                    title={level.label}
                    text={level.explain || explainLevel(level.label)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}
