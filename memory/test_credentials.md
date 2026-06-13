# Allogo Test Credentials

## Admin
- **Email**: admin@volttaxi.com
- **Password**: admin123

## Passenger
- **Email**: passenger@test.com
- **Password**: password

## Drivers
### Driver 1 (VTC only)
- **Email**: driver@test.com
- **Password**: password
- **Vehicle Types**: ["vtc"]

### Driver 2 (VTC + Van)
- **Email**: driver3@test.com
- **Password**: password
- **Vehicle Types**: ["vtc", "van"]

## Notes
- Token is stored in localStorage as `volt_token`
- Driver availability endpoint: PUT `/api/users/availability`
- Vehicle types: "vtc", "van", "taxi"
