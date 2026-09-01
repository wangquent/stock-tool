import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time
} from 'lightweight-charts'
import type { PriceBox } from '../../../shared/types'
import { parseBusinessDay } from './marketHours'

interface BoxViewData {
  x1: number | null
  x2: number | null
  y1: number | null
  y2: number | null
  isMain: boolean
}

class BoxRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly data: BoxViewData[]) {}

  draw(target: { useMediaCoordinateSpace: (fn: (scope: { context: CanvasRenderingContext2D }) => void) => void }): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const box of this.data) {
        if (box.x1 == null || box.x2 == null || box.y1 == null || box.y2 == null) continue
        const left = Math.min(box.x1, box.x2)
        const top = Math.min(box.y1, box.y2)
        const width = Math.abs(box.x2 - box.x1)
        const height = Math.abs(box.y2 - box.y1)
        context.fillStyle = box.isMain ? 'rgba(88, 166, 255, 0.14)' : 'rgba(88, 166, 255, 0.07)'
        context.strokeStyle = box.isMain ? 'rgba(88, 166, 255, 0.85)' : 'rgba(88, 166, 255, 0.4)'
        context.lineWidth = 1
        context.fillRect(left, top, width, height)
        context.strokeRect(left, top, width, height)
      }
    })
  }
}

class BoxPaneView implements IPrimitivePaneView {
  private data: BoxViewData[] = []

  constructor(
    private readonly getChart: () => IChartApi | undefined,
    private readonly getSeries: () => ISeriesApi<SeriesType> | undefined,
    private readonly getBoxes: () => PriceBox[]
  ) {}

  zOrder(): 'bottom' {
    return 'bottom'
  }

  update(): void {
    const chart = this.getChart()
    const series = this.getSeries()
    if (!chart || !series) {
      this.data = []
      return
    }
    const timeScale = chart.timeScale()
    this.data = this.getBoxes().map((box, index) => {
      const start = parseBusinessDay(box.startTime)
      const end = parseBusinessDay(box.endTime)
      return {
        x1: start ? timeScale.timeToCoordinate(start) : null,
        x2: end ? timeScale.timeToCoordinate(end) : null,
        y1: series.priceToCoordinate(box.high),
        y2: series.priceToCoordinate(box.low),
        isMain: index === 0
      }
    })
  }

  renderer(): IPrimitivePaneRenderer {
    return new BoxRenderer(this.data)
  }
}

export class BoxPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | undefined
  private series: ISeriesApi<SeriesType> | undefined
  private paneView: BoxPaneView
  private boxes: PriceBox[] = []
  private requestUpdate: (() => void) | undefined

  constructor() {
    this.paneView = new BoxPaneView(
      () => this.chart,
      () => this.series,
      () => this.boxes
    )
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart
    this.series = param.series
    this.requestUpdate = param.requestUpdate
  }

  detached(): void {
    this.chart = undefined
    this.series = undefined
    this.requestUpdate = undefined
  }

  updateAllViews(): void {
    this.paneView.update()
  }

  paneViews(): IPrimitivePaneView[] {
    return [this.paneView]
  }

  setBoxes(boxes: PriceBox[]): void {
    this.boxes = boxes
    this.requestUpdate?.()
  }
}
