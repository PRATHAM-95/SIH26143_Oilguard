/**
 * Historical reference imagery catalog.
 *
 * Deepwater Horizon (DWH) public-archive imagery, bundled locally so the
 * workspace is fully self-contained when offline. Every asset is either in the
 * public domain (NASA / NOAA) — verified via the United States Government /
 * NASA media-usage policy — and the provenance note is always shown verbatim.
 *
 * Honesty rules for decorators:
 *  - Images are REAL, historically-accurate satellite scenes (MODIS / EO-1 /
 *    NOAA mapping), fetched from Wikimedia Commons archive mirrors.
 *  - They are explicitly labelled "historical reference — Deepwater Horizon
 *    2010 · public archive" and are NEVER presented as a live capture of the
 *    current case.
 *  - No SAR-scene decorator is fabricated. SAR detection in this tool is
 *    metadata-only (provenance-labelled); showing a synthetic "SAR pic" would be
 *    dishonest, so the gallery omits it rather than faking one.
 */
import dwhEo1LeakApr28 from '@/assets/reference/dwh_eo1_leak_apr28.jpg'
import dwhLoopCurrentMay07 from '@/assets/reference/dwh_loop_current_may07.jpg'
import dwhModisMay24_2010 from '@/assets/reference/dwh_modis_may24_2010.jpg'
import dwhNoaaMapApr30 from '@/assets/reference/dwh_noaa_map_apr30.jpg'

export type ReferenceImagery = {
  id: string
  title: string
  kind: 'OPTICAL' | 'MAP'
  instrument: string
  /** Where the slicks actually appear in the frame (used for "isn't live" honesty). */
  acquired: string
  source: string
  license: string
  attribution: string
  note: string
  src: string
}

export const REFERENCE_IMAGERY: ReferenceImagery[] = [
  {
    id: 'dwh_eo1_leak',
    title: 'Oil leak from damaged well',
    kind: 'OPTICAL',
    instrument: 'EO-1 · ALI',
    acquired: '28 Apr 2010',
    source: 'NASA Earth Observatory',
    license: 'Public domain (NASA)',
    attribution: 'NASA / EO-1 ALI · public domain',
    note: 'Close-up of the Deepwater Horizon leak plume in sunglint.',
    src: dwhEo1LeakApr28,
  },
  {
    id: 'dwh_modis_may24',
    title: 'Slick in sunglint — Gulf of Mexico',
    kind: 'OPTICAL',
    instrument: 'MODIS · Terra/Aqua',
    acquired: '24 May 2010',
    source: 'NASA Earth Observatory',
    license: 'Public domain (NASA)',
    attribution: 'NASA MODIS Rapid Response · public domain',
    note: 'Silvery oil sheen made visible by mirror-like sunglint.',
    src: dwhModisMay24_2010,
  },
  {
    id: 'dwh_loop_current',
    title: 'Slick approaching the Loop Current',
    kind: 'OPTICAL',
    instrument: 'MODIS · Terra/Aqua',
    acquired: '7 May 2010',
    source: 'NASA Earth Observatory',
    license: 'Public domain (NASA)',
    attribution: 'NASA MODIS · public domain',
    note: 'Warm Loop Current (yellow) vs cooler Gulf water — the oil track.',
    src: dwhLoopCurrentMay07,
  },
  {
    id: 'dwh_noaa_map',
    title: 'NOAA Deepwater Horizon trajectory map',
    kind: 'MAP',
    instrument: 'NOAA ERMA sidebar',
    acquired: '30 Apr 2010',
    source: 'NOAA (public domain)',
    license: 'Public domain (US Gov)',
    attribution: 'NOAA · public domain, US Gov',
    note: 'The kind of reference trajectory map analysts pair with imagery.',
    src: dwhNoaaMapApr30,
  },
]

export const REFERENCE_NOTE =
  'Historical reference — Deepwater Horizon 2010 · public-domain archive imagery. Shown for context only; it is never a live capture of the current case and is never used as detection evidence. SAR scenes are not faked in this tool.'
