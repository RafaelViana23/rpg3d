// Same model now used by street fixtures; mirrored here to match the reference view.
import {createCityStreetLantern} from '../../src/editor/CityStreetLantern';
export function createComparisonLantern(){const model=createCityStreetLantern();model.scale.x=-1;return model;}
