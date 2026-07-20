/**
 * This is the template query used for fetching event listings from
 * the ResAdv API. It allows filtering and pagination of event data,
 * including details about the events, artists, venues, and associated
 * images.
 */
export const queryRAEventListings = `query GET_EVENT_LISTINGS($filters: FilterInputDtoInput, $filterOptions: FilterOptionsInputDtoInput, $page: Int, $pageSize: Int) 
{
  eventListings(filters: $filters, filterOptions: $filterOptions, pageSize: $pageSize, page: $page) 
  {
    data {
      id 
      listingDate 
      event {
        ...eventListingsFields artists {id name __typename} 
        __typename
      } 
      __typename
    } 
    filterOptions {
      genre {label value __typename}
      __typename
    } 
    totalResults 
    __typename
  }
}
fragment eventListingsFields on Event {
  id 
  date 
  startTime 
  endTime 
  title 
  contentUrl 
  flyerFront 
  isTicketed 
  attending 
  queueItEnabled 
  newEventForm 
  images {
    id 
    filename 
    alt 
    type 
    crop 
    __typename
  } 
  pick {
    id 
    blurb 
    __typename
  } 
  venue {
    id 
    name 
    address
    contentUrl 
    live 
    __typename
  } 
  __typename
}`;
