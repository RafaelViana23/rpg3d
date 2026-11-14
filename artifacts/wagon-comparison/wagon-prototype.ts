import {createCityWagon} from '../../src/editor/CityWagon';
export function createComparisonWagon(){const wagon=createCityWagon();wagon.rotation.y=-Math.PI/2;return wagon;}
