import Polygon from 'ol/geom/Polygon'
import { fromLonLat, toLonLat } from 'ol/proj'
import { getDistance } from 'ol/sphere'
import { buildExclusionZoneFeatures } from './exclusionZoneFeatures'

describe('buildExclusionZoneFeatures', () => {
  it('preserves the supplied polygon boundary after projection', () => {
    const boundary = [
      [-0.1, 51.5],
      [-0.1, 51.51],
      [-0.09, 51.51],
      [-0.1, 51.5],
    ]
    const features = buildExclusionZoneFeatures([
      {
        name: 'Polygon zone',
        address: '1 Test St',
        geometry: { type: 'Polygon', coordinates: [boundary] },
      },
    ])
    expect(features).toHaveLength(1)
    const feature = features[0]
    const geometry = feature.getGeometry()
    expect(geometry).toBeInstanceOf(Polygon)
    if (!(geometry instanceof Polygon)) throw new Error('Expected polygon geometry')
    expect(geometry.getCoordinates()).toEqual([boundary.map(coordinate => fromLonLat(coordinate))])
    expect(feature.get('name')).toBe('Polygon zone')
    expect(feature.get('address')).toBe('1 Test St')
  })

  it.each([100, 250])('renders a circular exclusion at the supplied centre with radius %s metres', radiusMetres => {
    const centre = [-0.1, 51.5]
    const features = buildExclusionZoneFeatures([
      {
        name: 'Circle zone',
        address: '2 Test St',
        geometry: { type: 'Point', coordinates: centre, radiusMetres },
      },
    ])
    expect(features).toHaveLength(1)
    const feature = features[0]
    const geometry = feature.getGeometry()
    expect(geometry).toBeInstanceOf(Polygon)
    if (!(geometry instanceof Polygon)) throw new Error('Expected circular polygon')
    const boundary = geometry.getCoordinates()[0]
    expect(boundary).toHaveLength(65)
    expect(boundary[0]).toEqual(boundary[64])
    boundary.forEach(coordinate => expect(getDistance(centre, toLonLat(coordinate))).toBeCloseTo(radiusMetres, 3))
  })

  it.each([0, -1, NaN, Infinity])('skips an invalid point radius of %s', radiusMetres => {
    expect(
      buildExclusionZoneFeatures([
        { name: 'Invalid circle', geometry: { type: 'Point', coordinates: [-0.1, 51.5], radiusMetres } },
      ]),
    ).toEqual([])
  })

  it('handles an empty or absent zone list', () => {
    expect(buildExclusionZoneFeatures([])).toEqual([])
    expect(buildExclusionZoneFeatures(null)).toEqual([])
  })
})
